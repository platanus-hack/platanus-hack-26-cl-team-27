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
  title: 'Presupuesto Los Aromos',
  pointer: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
  contentHash: 'a'.repeat(64),
  checkedAt: new Date('2026-11-21T10:00:00Z'),
  changedAt: null,
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
  watch: {
    execute: vi.fn(async () => ({
      status: 'changed' as const,
      source: { ...SOURCE, changedAt: new Date('2026-11-21T10:05:00Z') },
      message: 'La planilla cambió: 1 celda',
      cells: 1,
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

const stateOf = async (
  call: Awaited<ReturnType<typeof start>>['call'],
): Promise<string> => {
  const response = await call('/google/authorize', { method: 'POST' });
  const { url } = (await response.json()) as { url: string };
  return new URL(url).searchParams.get('state') ?? '';
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
    const state = await stateOf(started.call);

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
    const state = await stateOf(started.call);

    const callback = await started.call(
      `/google/callback?error=access_denied&state=${state}`,
    );
    const location = new URL(callback.headers.get('location') ?? '');
    expect(location.searchParams.get('motivo')).toBe(
      'Cancelaste la conexión con Google',
    );
  });

  it('vincula la planilla por su link', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    const response = await started.call('/sources', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      source: {
        id: SOURCE_ID,
        provider: 'google',
        title: 'Presupuesto Los Aromos',
        pointer: SOURCE.pointer,
        checkedAt: '2026-11-21T10:00:00.000Z',
        changedAt: null,
        createdAt: '2026-11-21T10:00:00.000Z',
        lastError: null,
      },
    });
    expect(setup.link.execute).toHaveBeenCalledWith(
      'https://docs.google.com/spreadsheets/d/sheet-1/edit',
    );
  });

  it('revisa la planilla ahora y dice cuántas celdas cambiaron', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    const response = await started.call(`/sources/${SOURCE_ID}/check`, {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      source: { id: SOURCE_ID, changedAt: '2026-11-21T10:05:00.000Z' },
      check: {
        status: 'changed',
        message: 'La planilla cambió: 1 celda',
        cells: 1,
      },
    });
    expect(setup.watch.execute).toHaveBeenCalledWith(SOURCE_ID);
  });

  it('traduce los errores del conector y de Google', async () => {
    const setup = fakeSetup();
    setup.link.execute.mockRejectedValueOnce(
      new ProviderError('Tu cuenta de Google no tiene acceso a esa planilla'),
    );
    setup.watch.execute.mockRejectedValueOnce(
      new IntegrationError(
        'source_not_found',
        'Esa planilla ya no está vinculada',
      ),
    );
    const started = await start(setup);
    app = started.app;

    const link = await started.call('/sources', {
      method: 'POST',
      body: JSON.stringify({ url: 'x' }),
    });
    expect(link.status).toBe(502);
    expect(await link.json()).toEqual({
      code: 'provider_error',
      message: 'Tu cuenta de Google no tiene acceso a esa planilla',
    });

    const check = await started.call(`/sources/${SOURCE_ID}/check`, {
      method: 'POST',
    });
    expect(check.status).toBe(404);
  });
});
