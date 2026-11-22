import { HttpStatus, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  IntegrationError,
  type LinkRequest,
  ProviderError,
  type SourceLink,
} from '@team27/context-integrations';

import { APP_OPTIONS, setupApp } from '../../../src/app.setup.ts';
import { AccountGuard } from '../../../src/modules/accounts/account.guard.ts';
import {
  type Account,
  AccountsService,
} from '../../../src/modules/accounts/accounts.service.ts';
import { fail } from '../../../src/modules/coordination/http-errors.ts';
import { ConnectorsController } from '../../../src/modules/integrations/connectors.controller.ts';
import {
  GOOGLE_SETUP,
  type GoogleSetup,
  INTEGRATIONS_CONFIG,
  renewalEveryMs,
  IntegrationsService,
} from '../../../src/modules/integrations/integrations.service.ts';
import { OAuthStates } from '../../../src/modules/integrations/oauth-states.ts';

const SOURCE_ID = '3f1d2c4b-5a69-4f7e-8d90-1a2b3c4d5e6f';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/sheet-1/edit';

const DANIELA: Account = {
  id: 'u1',
  email: 'daniela@example.com',
  name: 'Daniela',
  superadmin: false,
  memberships: [
    {
      organizationId: 'aromos',
      organizationName: 'Inmobiliaria Los Aromos',
      role: 'admin',
    },
    { organizationId: 'otra', organizationName: 'Otra', role: 'member' },
  ],
};

const PROJECTS: Readonly<Record<string, string>> = {
  'los-aromos': 'aromos',
  torre: 'otra',
  ajeno: 'nadie',
};

const SOURCE: SourceLink = {
  id: SOURCE_ID,
  projectId: 'los-aromos',
  connectionId: 'c1',
  provider: 'google',
  externalId: 'sheet-1',
  title: 'Presupuesto Los Aromos',
  pointer: SHEET_URL,
  contentHash: 'a'.repeat(64),
  checkedAt: new Date('2026-11-21T10:00:00Z'),
  changedAt: null,
  changedBy: null,
  lastError: null,
  channel: null,
  createdAt: new Date('2026-11-21T10:00:00Z'),
};

const fakeAccounts = () => ({
  authenticate: vi.fn(async (token: string) => {
    if (token !== 'token-daniela') {
      throw fail(HttpStatus.UNAUTHORIZED, 'invalid_token', 'x');
    }
    return DANIELA;
  }),
  requireProject: vi.fn(async (account: Account, projectId: string) => {
    const organization = PROJECTS[projectId];
    if (
      !account.memberships.some((item) => item.organizationId === organization)
    ) {
      throw fail(HttpStatus.NOT_FOUND, 'not_found', 'x');
    }
  }),
});

const fakeSetup = () => {
  const linked: SourceLink[] = [];
  return {
    linked,
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
        userId: 'u1',
        provider: 'google' as const,
        accountEmail: 'daniela@example.com',
        scopes: [],
        connectedAt: new Date('2026-11-21T10:00:00Z'),
      })),
    },
    link: {
      execute: vi.fn(async (request: LinkRequest) => {
        const source = { ...SOURCE, projectId: request.projectId };
        linked.push(source);
        return source;
      }),
    },
    unlink: { execute: vi.fn(async () => undefined) },
    list: {
      execute: vi.fn(async (projectId?: string) =>
        linked.filter(
          (source) => projectId === undefined || source.projectId === projectId,
        ),
      ),
    },
    watch: {
      execute: vi.fn(async () => ({
        status: 'changed' as const,
        source: { ...SOURCE, changedAt: new Date('2026-11-21T10:05:00Z') },
        message: 'La planilla cambió: 1 celda',
        cells: 1,
      })),
    },
    push: null as null | {
      subscribe: { execute: ReturnType<typeof vi.fn> };
      unsubscribe: { execute: ReturnType<typeof vi.fn> };
      receive: { execute: ReturnType<typeof vi.fn> };
    },
  };
};

const PUSH = {
  address: 'https://vigente.example/api/integrations/google/notifications',
  ttlMs: 86_400_000,
  renewMarginMs: 7_200_000,
  fallbackMs: 900_000,
  debounceMs: 10,
};

const withPush = (setup: ReturnType<typeof fakeSetup>) => {
  const push = {
    subscribe: {
      execute: vi.fn(async (id: string) => ({
        status: 'subscribed' as const,
        source: {
          ...SOURCE,
          id,
          channel: {
            id: 'ch-1',
            resourceId: 'res-1',
            token: 'secret-1',
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        },
        message: 'Google avisa los cambios',
      })),
    },
    unsubscribe: { execute: vi.fn(async () => true) },
    receive: {
      execute: vi.fn(
        async (): Promise<{ kind: string; sourceId?: string }> => ({
          kind: 'check',
          sourceId: SOURCE_ID,
        }),
      ),
    },
  };
  setup.push = push;
  return push;
};

const start = async (
  setup: ReturnType<typeof fakeSetup> | null,
  push: typeof PUSH | null = null,
) => {
  const accounts = fakeAccounts();
  const moduleRef = await Test.createTestingModule({
    controllers: [ConnectorsController],
    providers: [
      IntegrationsService,
      AccountGuard,
      { provide: AccountsService, useValue: accounts },
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
          push,
        },
      },
    ],
  }).compile();
  const app: INestApplication = setupApp(
    moduleRef.createNestApplication({ ...APP_OPTIONS, logger: false }),
  );
  await app.listen(0);
  const base = `${await app.getUrl()}/api/integrations`;
  const call = (path: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token-daniela',
        ...init.headers,
      },
    });
  return { app, call, accounts };
};

type Call = Awaited<ReturnType<typeof start>>['call'];

const stateOf = async (call: Call, projectId?: string): Promise<string> => {
  const response = await call('/google/authorize', {
    method: 'POST',
    body: JSON.stringify(projectId ? { projectId } : {}),
  });
  const { url } = (await response.json()) as { url: string };
  return new URL(url).searchParams.get('state') ?? '';
};

const linkIn = (call: Call, projectId: string) =>
  call(`/projects/${projectId}/sources`, {
    method: 'POST',
    body: JSON.stringify({ url: SHEET_URL }),
  });

describe('ConnectorsController', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it('pide entrar con la cuenta', async () => {
    const started = await start(fakeSetup());
    app = started.app;

    const anonymous = await started.call('/projects/los-aromos', {
      headers: { authorization: '' },
    });
    expect(anonymous.status).toBe(401);
    const other = await started.call('/projects/los-aromos', {
      headers: { authorization: 'Bearer otro' },
    });
    expect(other.status).toBe(401);
  });

  it('no muestra un proyecto de una organización ajena', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    const response = await started.call('/projects/ajeno');

    expect(response.status).toBe(404);
    expect(setup.list.execute).not.toHaveBeenCalled();
    expect((await linkIn(started.call, 'ajeno')).status).toBe(404);
    expect(setup.link.execute).not.toHaveBeenCalled();
  });

  it('cada proyecto ve solo sus planillas', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    expect((await linkIn(started.call, 'los-aromos')).status).toBe(201);

    const aromos = (await (
      await started.call('/projects/los-aromos')
    ).json()) as { sources: { id: string }[] };
    const torre = (await (await started.call('/projects/torre')).json()) as {
      sources: { id: string }[];
    };
    expect(aromos.sources.map((source) => source.id)).toEqual([SOURCE_ID]);
    expect(torre.sources).toEqual([]);
  });

  it('muestra la cuenta de Google de quien mira', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    const overview = await started.call('/projects/los-aromos');

    expect(await overview.json()).toEqual({
      google: {
        configured: true,
        connection: {
          accountEmail: 'daniela@example.com',
          connectedAt: '2026-11-21T10:00:00.000Z',
        },
        pollSeconds: 0,
        push: {
          enabled: false,
          reason:
            'Sin GOOGLE_WEBHOOK_URL: la API le pregunta a Google cada cierto tiempo',
          fallbackSeconds: null,
        },
      },
      sources: [],
    });
    expect(setup.connection.execute).toHaveBeenCalledWith('u1');
    expect(setup.list.execute).toHaveBeenCalledWith('los-aromos');
  });

  it('sin Google configurado, muestra el estado y no deja conectar', async () => {
    const started = await start(null);
    app = started.app;

    const overview = await started.call('/projects/los-aromos');
    expect(await overview.json()).toEqual({
      google: {
        configured: false,
        connection: null,
        pollSeconds: 0,
        push: { enabled: false, reason: null, fallbackSeconds: null },
      },
      sources: [],
    });
    const authorize = await started.call('/google/authorize', {
      method: 'POST',
      body: '{}',
    });
    expect(authorize.status).toBe(503);
    expect(await authorize.json()).toMatchObject({ code: 'not_configured' });
  });

  it('conecta la cuenta de Google de la persona y vuelve a su proyecto', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;
    const state = await stateOf(started.call, 'los-aromos');

    const callback = await started.call(
      `/google/callback?code=code-1&state=${state}&scope=email`,
      { headers: { authorization: '' } },
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe(
      'http://localhost:3000/conectores?proyecto=los-aromos&google=conectado',
    );
    expect(setup.connect.execute).toHaveBeenCalledWith('u1', 'code-1');

    const replay = await started.call(
      `/google/callback?code=code-1&state=${state}`,
    );
    const location = new URL(replay.headers.get('location') ?? '');
    expect(location.searchParams.get('google')).toBe('error');
    expect(location.searchParams.get('motivo')).toMatch(/venció/);
  });

  it('no deja conectar Google desde un proyecto ajeno', async () => {
    const started = await start(fakeSetup());
    app = started.app;

    const response = await started.call('/google/authorize', {
      method: 'POST',
      body: JSON.stringify({ projectId: 'ajeno' }),
    });

    expect(response.status).toBe(404);
  });

  it('si la persona cancela en Google, vuelve con el motivo', async () => {
    const started = await start(fakeSetup());
    app = started.app;
    const state = await stateOf(started.call);

    const callback = await started.call(
      `/google/callback?error=access_denied&state=${state}`,
    );
    const location = new URL(callback.headers.get('location') ?? '');
    expect(location.pathname).toBe('/conectores');
    expect(location.searchParams.get('proyecto')).toBeNull();
    expect(location.searchParams.get('motivo')).toBe(
      'Cancelaste la conexión con Google',
    );
  });

  it('desconecta solo la cuenta de quien lo pide', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    const response = await started.call('/google', { method: 'DELETE' });

    expect(response.status).toBe(204);
    expect(setup.disconnect.execute).toHaveBeenCalledWith('u1');
  });

  it('vincula la planilla al proyecto con la cuenta de quien la vincula', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    const response = await linkIn(started.call, 'los-aromos');

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      source: {
        id: SOURCE_ID,
        provider: 'google',
        title: 'Presupuesto Los Aromos',
        pointer: SHEET_URL,
        checkedAt: '2026-11-21T10:00:00.000Z',
        changedAt: null,
        changedBy: null,
        createdAt: '2026-11-21T10:00:00.000Z',
        lastError: null,
        push: { active: false, expiresAt: null },
      },
    });
    expect(setup.link.execute).toHaveBeenCalledWith({
      userId: 'u1',
      projectId: 'los-aromos',
      url: SHEET_URL,
    });
  });

  it('revisa la planilla del proyecto y dice cuántas celdas cambiaron', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    const response = await started.call(
      `/projects/los-aromos/sources/${SOURCE_ID}/check`,
      { method: 'POST' },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      source: { id: SOURCE_ID, changedAt: '2026-11-21T10:05:00.000Z' },
      check: {
        status: 'changed',
        message: 'La planilla cambió: 1 celda',
        cells: 1,
      },
    });
    expect(setup.watch.execute).toHaveBeenCalledWith(SOURCE_ID, 'los-aromos');
  });

  it('desvincula la planilla del proyecto', async () => {
    const setup = fakeSetup();
    const started = await start(setup);
    app = started.app;

    const response = await started.call(
      `/projects/los-aromos/sources/${SOURCE_ID}`,
      { method: 'DELETE' },
    );

    expect(response.status).toBe(204);
    expect(setup.unlink.execute).toHaveBeenCalledWith('los-aromos', SOURCE_ID);
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

    const link = await linkIn(started.call, 'los-aromos');
    expect(link.status).toBe(502);
    expect(await link.json()).toEqual({
      code: 'provider_error',
      message: 'Tu cuenta de Google no tiene acceso a esa planilla',
    });

    const check = await started.call(
      `/projects/torre/sources/${SOURCE_ID}/check`,
      { method: 'POST' },
    );
    expect(check.status).toBe(404);
  });

  describe('avisos de Google Drive', () => {
    const notify = (
      call: Call,
      headers: Record<string, string>,
    ): Promise<Response> =>
      call('/google/notifications', {
        method: 'POST',
        headers: { authorization: '', ...headers },
      });

    const NOTICE = {
      'x-goog-channel-id': 'ch-1',
      'x-goog-channel-token': 'secret-1',
      'x-goog-resource-id': 'res-1',
      'x-goog-resource-state': 'update',
      'x-goog-changed': 'content',
    };

    it('al vincular, pide a Google que avise los cambios', async () => {
      const setup = fakeSetup();
      const push = withPush(setup);
      const started = await start(setup, PUSH);
      app = started.app;

      const response = await linkIn(started.call, 'los-aromos');

      expect(response.status).toBe(201);
      expect(push.subscribe.execute).toHaveBeenCalledWith(SOURCE_ID, PUSH);
      expect(await response.json()).toMatchObject({
        source: { push: { active: true } },
      });
    });

    it('un aviso válido revisa la planilla sin pedir cuenta', async () => {
      const setup = fakeSetup();
      const push = withPush(setup);
      const started = await start(setup, PUSH);
      app = started.app;

      const response = await notify(started.call, NOTICE);

      expect(response.status).toBe(204);
      expect(push.receive.execute).toHaveBeenCalledWith({
        channelId: 'ch-1',
        resourceId: 'res-1',
        token: 'secret-1',
        state: 'update',
        changed: ['content'],
      });
      await vi.waitFor(() =>
        expect(setup.watch.execute).toHaveBeenCalledWith(SOURCE_ID),
      );
    });

    it('junta una ráfaga de avisos en una sola revisión', async () => {
      const setup = fakeSetup();
      withPush(setup);
      const started = await start(setup, PUSH);
      app = started.app;

      await Promise.all([
        notify(started.call, NOTICE),
        notify(started.call, NOTICE),
        notify(started.call, NOTICE),
      ]);

      await vi.waitFor(() => expect(setup.watch.execute).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(setup.watch.execute).toHaveBeenCalledTimes(1);
    });

    it('rechaza un aviso con un secreto que no calza', async () => {
      const setup = fakeSetup();
      const push = withPush(setup);
      push.receive.execute.mockResolvedValueOnce({ kind: 'rejected' });
      const started = await start(setup, PUSH);
      app = started.app;

      const response = await notify(started.call, NOTICE);

      expect(response.status).toBe(403);
      expect(setup.watch.execute).not.toHaveBeenCalled();
    });

    it('rechaza un pedido que no es un aviso de Drive', async () => {
      const setup = fakeSetup();
      withPush(setup);
      const started = await start(setup, PUSH);
      app = started.app;

      const response = await notify(started.call, {});

      expect(response.status).toBe(400);
    });

    it('al desvincular, cierra la suscripción en Google', async () => {
      const setup = fakeSetup();
      const push = withPush(setup);
      setup.linked.push(SOURCE);
      const started = await start(setup, PUSH);
      app = started.app;

      const response = await started.call(
        `/projects/los-aromos/sources/${SOURCE_ID}`,
        { method: 'DELETE' },
      );

      expect(response.status).toBe(204);
      expect(push.unsubscribe.execute).toHaveBeenCalledWith(SOURCE_ID);
    });

    it('sin sondeo, igual suscribe al arrancar las planillas ya vinculadas', async () => {
      const setup = fakeSetup();
      const push = withPush(setup);
      setup.linked.push(SOURCE);
      const started = await start(setup, PUSH);
      app = started.app;

      await vi.waitFor(
        () =>
          expect(push.subscribe.execute).toHaveBeenCalledWith(SOURCE_ID, PUSH),
        { timeout: 3000 },
      );
      expect(setup.watch.execute).not.toHaveBeenCalled();
    });

    it('la renovación corre antes de que venza el margen', () => {
      expect(renewalEveryMs(PUSH)).toBe(3_600_000);
      expect(
        renewalEveryMs({ ...PUSH, ttlMs: 3_600_000, renewMarginMs: 900_000 }),
      ).toBe(450_000);
    });

    it('sin GOOGLE_WEBHOOK_URL lo dice en el estado', async () => {
      const started = await start(fakeSetup());
      app = started.app;

      const response = await started.call('/projects/los-aromos');

      expect(await response.json()).toMatchObject({
        google: { push: { enabled: false } },
      });
    });
  });
});
