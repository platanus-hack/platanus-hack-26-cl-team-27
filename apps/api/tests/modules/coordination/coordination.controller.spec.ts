import { HttpStatus, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { setupApp } from '../../../src/app.setup.ts';
import { AccountGuard } from '../../../src/modules/accounts/account.guard.ts';
import {
  type Account,
  AccountsService,
} from '../../../src/modules/accounts/accounts.service.ts';
import { CoordinationController } from '../../../src/modules/coordination/coordination.controller.ts';
import { CoordinationService } from '../../../src/modules/coordination/coordination.service.ts';
import { EventsService } from '../../../src/modules/coordination/events.service.ts';
import { fail } from '../../../src/modules/coordination/http-errors.ts';
import { QueryService } from '../../../src/modules/coordination/query.service.ts';
import { ProjectCatalogs } from '../../../src/modules/project/project.module.ts';
import { project } from '../../project.ts';

const NOTIFICATION_ID = '3f1d2c4b-5a69-4f7e-8d90-1a2b3c4d5e6f';

const account = (id: string, organizationId = 'aromos'): Account => ({
  id,
  email: `${id}@example.com`,
  name: id,
  superadmin: false,
  memberships: [
    { organizationId, organizationName: 'Organización', role: 'member' },
  ],
});

const ACCOUNTS: Readonly<Record<string, Account>> = {
  'token-paula': account('paula-rojas'),
  'token-visita': account('visita'),
  'token-ajena': account('ajena', 'otra'),
};

const fakeAccounts = () => ({
  authenticate: vi.fn(async (token: string) => {
    const found = ACCOUNTS[token];
    if (!found) throw fail(HttpStatus.UNAUTHORIZED, 'invalid_token', 'x');
    return found;
  }),
  requireProject: vi.fn(async (who: Account, projectId: string) => {
    const inOrganization = who.memberships.some(
      (item) => item.organizationId === 'aromos',
    );
    if (projectId !== project.id || !inOrganization) {
      throw fail(HttpStatus.NOT_FOUND, 'not_found', 'x');
    }
  }),
});

const start = async () => {
  const accounts = fakeAccounts();
  const catalogs = { load: vi.fn(async () => project) };
  const queries = {
    spaces: vi.fn(async () => ({ spaces: [] })),
    inbox: vi.fn(async () => ({ items: [] })),
  };
  const coordination = {
    vote: vi.fn(async () => ({ merged: false })),
  };
  const events = {
    list: vi.fn(async () => ({ cursor: 3, reset: false, events: [] })),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [CoordinationController],
    providers: [
      AccountGuard,
      { provide: AccountsService, useValue: accounts },
      { provide: ProjectCatalogs, useValue: catalogs },
      { provide: QueryService, useValue: queries },
      { provide: CoordinationService, useValue: coordination },
      { provide: EventsService, useValue: events },
    ],
  }).compile();
  const app: INestApplication = setupApp(
    moduleRef.createNestApplication({ logger: false }),
  );
  await app.listen(0);
  const base = `${await app.getUrl()}/api/projects`;
  const call = (path: string, token: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: token ? `Bearer ${token}` : '',
        ...init.headers,
      },
    });
  return { app, call, catalogs, queries, coordination, events };
};

const respond = (
  call: Awaited<ReturnType<typeof start>>['call'],
  token: string,
) =>
  call(`/${project.id}/notifications/${NOTIFICATION_ID}/response`, token, {
    method: 'POST',
    body: JSON.stringify({ kind: 'reviewed' }),
  });

describe('CoordinationController', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it('pide entrar con la cuenta', async () => {
    const started = await start();
    app = started.app;

    expect((await started.call(`/${project.id}/spaces`, '')).status).toBe(401);
    expect((await started.call(`/${project.id}/spaces`, 'otro')).status).toBe(
      401,
    );
    expect(started.catalogs.load).not.toHaveBeenCalled();
  });

  it('no abre un proyecto de una organización ajena', async () => {
    const started = await start();
    app = started.app;

    const response = await started.call(`/${project.id}/spaces`, 'token-ajena');

    expect(response.status).toBe(404);
    expect(started.catalogs.load).not.toHaveBeenCalled();
    expect(started.queries.spaces).not.toHaveBeenCalled();
  });

  it('lee el proyecto que pide la ruta', async () => {
    const started = await start();
    app = started.app;

    const response = await started.call(
      `/${project.id}/spaces`,
      'token-visita',
    );

    expect(response.status).toBe(200);
    expect(started.catalogs.load).toHaveBeenCalledWith(project.id);
    expect(started.queries.spaces).toHaveBeenCalledWith(project);
  });

  it('la bandeja es la de quien entra', async () => {
    const started = await start();
    app = started.app;

    await started.call(`/${project.id}/inbox`, 'token-paula');

    expect(started.queries.inbox).toHaveBeenCalledWith(project, 'paula-rojas');
  });

  it('responde un aviso solo si eres parte del equipo del proyecto', async () => {
    const started = await start();
    app = started.app;

    const outsider = await respond(started.call, 'token-visita');
    expect(outsider.status).toBe(403);
    expect(await outsider.json()).toMatchObject({ code: 'not_on_team' });
    expect(started.coordination.vote).not.toHaveBeenCalled();

    const member = await respond(started.call, 'token-paula');
    expect(member.status).toBe(201);
    expect(started.coordination.vote).toHaveBeenCalledWith(
      expect.objectContaining({
        project,
        actor: 'paula-rojas',
        notificationId: NOTIFICATION_ID,
        vote: { kind: 'reviewed' },
      }),
    );
  });

  it('sigue los eventos del proyecto desde el cursor', async () => {
    const started = await start();
    app = started.app;

    const response = await started.call(
      `/${project.id}/events?after=2`,
      'token-visita',
    );

    expect(await response.json()).toEqual({
      cursor: 3,
      reset: false,
      events: [],
    });
    expect(started.events.list).toHaveBeenCalledWith(project.id, 2, 100);
  });
});
