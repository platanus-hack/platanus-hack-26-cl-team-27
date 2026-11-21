import { HttpStatus, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  IntegrationError,
  ProviderError,
  type SourceLink,
} from '@team27/context-integrations';

import { setupApp } from '../../../src/app.setup.ts';
import { fail } from '../../../src/modules/coordination/http-errors.ts';
import { ConnectorsController } from '../../../src/modules/integrations/connectors.controller.ts';
import {
  GOOGLE_SETUP,
  type GoogleSetup,
  INTEGRATIONS_CONFIG,
  IntegrationsService,
} from '../../../src/modules/integrations/integrations.service.ts';
import { OAuthStates } from '../../../src/modules/integrations/oauth-states.ts';
import { SeatsService } from '../../../src/modules/room/seats.service.ts';

const KEY = 'clave-de-prueba';
const SOURCE_ID = '3f1d2c4b-5a69-4f7e-8d90-1a2b3c4d5e6f';

const SOURCE: SourceLink = {
  id: SOURCE_ID,
  connectionId: 'c1',
  provider: 'google',
  externalId: 'sheet-1',
  documentId: 'presupuesto',
  title: 'Presupuesto Los Aromos',
  pointer: 'https://docs.google.com/spreadsheets/d/sheet-1/edit#gid=0',
  checkedAt: null,
  lastRead: null,
  lastError: null,
  createdAt: new Date('2026-11-21T10:00:00Z'),
};

const fakeSetup = () => ({
  connect: {
    authorizationUrl: vi.fn(
      (state: string) => `https://accounts.google.com/auth?state=${state}`,
    ),
    execute: vi.fn(async () => ({})),
  },
  disconnect: { execute: vi.fn(async () => true) },
  connection: {
    execute: vi.fn(async () => ({
      id: 'c1',
      provider: 'google' as const,
      accountEmail: 'daniela@example.com',
      scopes: [],
      connectedAt: new Date('2026-11-21T10:00:00Z'),
    })),
  },
  link: { execute: vi.fn(async () => SOURCE) },
  unlink: { execute: vi.fn(async () => undefined) },
  list: { execute: vi.fn(async () => [SOURCE]) },
  sync: {
    execute: vi.fn(async () => ({
      status: 'ingested' as const,
      source: SOURCE,
      message: 'Llegó la revisión: la obra ya tenía esos valores.',
      receipt: { revisionId: 'r1', proposals: 0, summary: '' },
    })),
  },
});

const start = async (setup: ReturnType<typeof fakeSetup> | null) => {
  const moduleRef = await Test.createTestingModule({
    controllers: [ConnectorsController],
    providers: [
      IntegrationsService,
      { provide: OAuthStates, useValue: new OAuthStates() },
      {
        provide: GOOGLE_SETUP,
        useValue: setup as unknown as GoogleSetup | null,
      },
      {
        provide: INTEGRATIONS_CONFIG,
        useValue: {
          pollMs: 0,
          redirectUri: 'http://localhost:3000/api/integrations/google/callback',
        },
      },
      {
        provide: SeatsService,
        useValue: {
          requirePresenter: (key: string | undefined) => {
            if (key !== KEY) {
              throw fail(HttpStatus.UNAUTHORIZED, 'presenter_required', 'x');
            }
          },
        },
      },
    ],
  }).compile();
  const app: INestApplication = setupApp(
    moduleRef.createNestApplication({ logger: false }),
  );
  await app.listen(0);
  const base = `${await app.getUrl()}/api/integrations`;
  const call = (path: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        'x-presenter-key': KEY,
        ...init.headers,
      },
    });
  return { app, call };
};

describe('ConnectorsController', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it('pide la clave del presentador', async () => {
    const started = await start(fakeSetup());
    app = started.app;
    const response = await started.call('', {
      headers: { 'x-presenter-key': 'otra' },
    });
    expect(response.status).toBe(401);
  });

  it('sin Google configurado, muestra el estado y no deja conectar', async () => {
    const started = await start(null);
    app = started.app;

    const overview = await started.call('');
    expect(await overview.json()).toEqual({
      google: { configured: false, connection: null, pollSeconds: 0 },
      sources: [],
      documents: [
        {
          id: 'presupuesto',
          name: 'Presupuesto itemizado',
          spaceName: 'Carpeta de costos',
          linked: false,
        },
      ],
    });
    const authorize = await started.call('/google/authorize', {
      method: 'POST',
    });
    expect(authorize.status).toBe(503);
    expect(await authorize.json()).toMatchObject({ code: 'not_configured' });
  });

  it('conecta Google y vuelve a la vista de conectores', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    const authorize = await started.call('/google/authorize', {
      method: 'POST',
    });
    const { url } = (await authorize.json()) as { url: string };
    const state = new URL(url).searchParams.get('state') ?? '';

    const callback = await started.call(
      `/google/callback?code=code-1&state=${state}&scope=email`,
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe(
      'http://localhost:3000/conectores?google=conectado',
    );
    expect(setup.connect.execute).toHaveBeenCalledWith('code-1');

    const replay = await started.call(
      `/google/callback?code=code-1&state=${state}`,
    );
    const location = new URL(replay.headers.get('location') ?? '');
    expect(location.searchParams.get('google')).toBe('error');
    expect(location.searchParams.get('motivo')).toMatch(/venció/);
  });

  it('si la persona cancela en Google, vuelve con el motivo', async () => {
    const started = await start(fakeSetup());
    app = started.app;
    const { url } = (await (
      await started.call('/google/authorize', { method: 'POST' })
    ).json()) as { url: string };
    const state = new URL(url).searchParams.get('state') ?? '';

    const callback = await started.call(
      `/google/callback?error=access_denied&state=${state}`,
    );
    const location = new URL(callback.headers.get('location') ?? '');
    expect(location.searchParams.get('motivo')).toBe(
      'Cancelaste la conexión con Google',
    );
  });

  it('vincula la planilla y la lee al tiro', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    const response = await started.call('/sources', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'presupuesto',
        url: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      source: {
        id: SOURCE_ID,
        documentName: 'Presupuesto itemizado',
        spaceName: 'Carpeta de costos',
      },
      sync: { status: 'ingested', revisionId: 'r1', proposals: 0 },
    });
    expect(setup.sync.execute).toHaveBeenCalledWith(SOURCE_ID);
  });

  it('solo deja vincular el presupuesto', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    const response = await started.call('/sources', {
      method: 'POST',
      body: JSON.stringify({ documentId: 'gantt', url: 'x' }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: 'unlinkable_document',
    });
    expect(setup.link.execute).not.toHaveBeenCalled();
  });

  it('traduce los errores del conector y de Google', async () => {
    const setup = fakeSetup();
    setup.link.execute.mockRejectedValueOnce(
      new ProviderError('Tu cuenta de Google no tiene acceso a esa planilla'),
    );
    setup.sync.execute.mockRejectedValueOnce(
      new IntegrationError(
        'source_not_found',
        'Esa planilla ya no está vinculada',
      ),
    );
    const started = await start(setup);
    app = started.app;

    const link = await started.call('/sources', {
      method: 'POST',
      body: JSON.stringify({ documentId: 'presupuesto', url: 'x' }),
    });
    expect(link.status).toBe(502);
    expect(await link.json()).toEqual({
      code: 'provider_error',
      message: 'Tu cuenta de Google no tiene acceso a esa planilla',
    });

    const sync = await started.call(`/sources/${SOURCE_ID}/sync`, {
      method: 'POST',
    });
    expect(sync.status).toBe(404);
  });
});
