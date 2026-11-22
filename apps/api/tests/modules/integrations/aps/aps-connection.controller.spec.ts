import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { APP_OPTIONS, setupApp } from '../../../../src/app.setup.ts';
import { AccountGuard } from '../../../../src/modules/accounts/account.guard.ts';
import {
  type Account,
  AccountsService,
} from '../../../../src/modules/accounts/accounts.service.ts';
import { ApsConnectionController } from '../../../../src/modules/integrations/aps/aps-connection.controller.ts';
import { ApsConnectionService } from '../../../../src/modules/integrations/aps/aps-connection.service.ts';
import {
  APS_CONNECTIONS,
  type ApsConnections,
} from '../../../../src/modules/integrations/aps/aps-connection.tokens.ts';
import { cipher, fakeClient, MemoryVault, stateOf } from './fakes.ts';

const CALLBACK = 'http://localhost:3000/api/integrations/aps/callback';

const accountFor = (role: 'admin' | 'member'): Account => ({
  id: 'user-1',
  email: 'fernanda@aromos.cl',
  name: 'Fernanda',
  superadmin: false,
  memberships: [
    {
      organizationId: 'aromos',
      organizationName: 'Inmobiliaria Los Aromos',
      role,
    },
  ],
});

const start = async (
  connections: ApsConnections | null,
  role: 'admin' | 'member' = 'admin',
) => {
  const accounts = Object.assign(Object.create(AccountsService.prototype), {
    authenticate: async () => accountFor(role),
  }) as AccountsService;
  const moduleRef = await Test.createTestingModule({
    controllers: [ApsConnectionController],
    providers: [
      { provide: APS_CONNECTIONS, useValue: connections },
      { provide: AccountsService, useValue: accounts },
      AccountGuard,
    ],
  }).compile();
  const app: INestApplication = setupApp(
    moduleRef.createNestApplication({ ...APP_OPTIONS, logger: false }),
  );
  await app.listen(0);
  return { app, base: `${await app.getUrl()}/api` };
};

const auth = { authorization: 'Bearer token' };

const configured = () => {
  const vault = new MemoryVault();
  const client = fakeClient();
  const service = new ApsConnectionService(vault, client, cipher());
  return { vault, client, connections: { service, callbackUrl: CALLBACK } };
};

const cookieOf = (response: Response): string => {
  const header = response.headers.get('set-cookie') ?? '';
  const pair = header.split(';')[0] ?? '';
  return pair;
};

describe('ApsConnectionController', () => {
  it('conecta la cuenta: autoriza, vuelve por el callback y muestra el estado', async () => {
    const { vault, client, connections } = configured();
    const { app, base } = await start(connections);
    try {
      const before = await fetch(
        `${base}/organizations/aromos/integrations/aps`,
        {
          headers: auth,
        },
      );
      expect(await before.json()).toEqual({
        configured: true,
        connection: null,
      });

      const authorize = await fetch(
        `${base}/organizations/aromos/integrations/aps/authorize`,
        { method: 'POST', headers: auth },
      );
      expect(authorize.status).toBe(200);
      expect(authorize.headers.get('cache-control')).toBe('no-store');
      const setCookie = authorize.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('vigente_aps_oauth=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/api/integrations/aps/callback');
      const { url } = (await authorize.json()) as { url: string };
      const state = stateOf(url);

      const callback = await fetch(
        `${base}/integrations/aps/callback?code=code-1&state=${encodeURIComponent(state)}`,
        { headers: { cookie: cookieOf(authorize) }, redirect: 'manual' },
      );
      expect(callback.status).toBe(302);
      expect(callback.headers.get('location')).toBe(
        'http://localhost:3000/cuenta?autodesk=conectada',
      );
      expect(callback.headers.get('set-cookie')).toContain(
        'vigente_aps_oauth=;',
      );
      expect(client.exchangeCode).toHaveBeenCalledWith('code-1');
      expect(vault.rows.get('aromos')?.connectedById).toBe('user-1');

      const after = await fetch(
        `${base}/organizations/aromos/integrations/aps`,
        {
          headers: auth,
        },
      );
      const body = await after.text();
      expect(body).not.toContain('access-1');
      expect(JSON.parse(body)).toMatchObject({
        configured: true,
        connection: {
          status: 'active',
          autodeskUser: { email: 'admin@aromos.cl' },
        },
      });

      const disconnect = await fetch(
        `${base}/organizations/aromos/integrations/aps`,
        { method: 'DELETE', headers: auth },
      );
      expect(disconnect.status).toBe(204);
      expect(vault.rows.size).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('el callback sin la cookie del navegador no conecta nada', async () => {
    const { vault, client, connections } = configured();
    const { app, base } = await start(connections);
    try {
      const authorize = await fetch(
        `${base}/organizations/aromos/integrations/aps/authorize`,
        { method: 'POST', headers: auth },
      );
      const { url } = (await authorize.json()) as { url: string };
      const callback = await fetch(
        `${base}/integrations/aps/callback?code=c&state=${encodeURIComponent(stateOf(url))}`,
        { redirect: 'manual' },
      );
      expect(callback.headers.get('location')).toBe(
        'http://localhost:3000/cuenta?autodesk=error&motivo=invalid_state',
      );
      const missing = await fetch(`${base}/integrations/aps/callback`, {
        redirect: 'manual',
      });
      expect(missing.headers.get('location')).toContain('motivo=invalid_state');
      expect(client.exchangeCode).not.toHaveBeenCalled();
      expect(vault.rows.size).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('solo un administrador conecta o desconecta; un miembro ve el estado', async () => {
    const { connections } = configured();
    const { app, base } = await start(connections, 'member');
    try {
      const status = await fetch(
        `${base}/organizations/aromos/integrations/aps`,
        {
          headers: auth,
        },
      );
      expect(status.status).toBe(200);
      for (const [method, path] of [
        ['POST', 'aromos/integrations/aps/authorize'],
        ['DELETE', 'aromos/integrations/aps'],
      ] as const) {
        const response = await fetch(`${base}/organizations/${path}`, {
          method,
          headers: auth,
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ code: 'admin_required' });
      }
      const other = await fetch(`${base}/organizations/otra/integrations/aps`, {
        headers: auth,
      });
      expect(other.status).toBe(403);
      const anonymous = await fetch(
        `${base}/organizations/aromos/integrations/aps`,
      );
      expect(anonymous.status).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('sin configurar, el estado lo dice y autorizar responde 503', async () => {
    const { app, base } = await start(null);
    try {
      const status = await fetch(
        `${base}/organizations/aromos/integrations/aps`,
        {
          headers: auth,
        },
      );
      expect(await status.json()).toEqual({
        configured: false,
        connection: null,
      });
      const authorize = await fetch(
        `${base}/organizations/aromos/integrations/aps/authorize`,
        { method: 'POST', headers: auth },
      );
      expect(authorize.status).toBe(503);
      expect(await authorize.json()).toMatchObject({
        code: 'aps_oauth_not_configured',
      });
    } finally {
      await app.close();
    }
  });
});
