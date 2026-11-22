import { HttpException } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import {
  type Account,
  AccountsService,
} from '../../../src/modules/accounts/accounts.service.ts';
import {
  type Identity,
  InvalidTokenError,
  type Profile,
} from '../../../src/modules/accounts/identity.ts';

interface UserRow {
  id: string;
  authSubject: string;
  email: string;
  name: string | null;
}

interface MembershipRow {
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

interface InvitationRow {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  createdAt: Date;
  acceptedAt: Date | null;
}

const fakeDb = () => {
  const organizations = new Map([
    ['aromos', { id: 'aromos', name: 'Inmobiliaria Los Aromos' }],
    ['otra', { id: 'otra', name: 'Otra Constructora' }],
  ]);
  const projects = [
    { id: 'los-aromos', organizationId: 'aromos', name: 'Edificio Los Aromos' },
    { id: 'torre', organizationId: 'otra', name: 'Torre Ajena' },
  ].map((project) => ({ ...project, location: '', description: '' }));
  const users: UserRow[] = [];
  const memberships: MembershipRow[] = [];
  const invitations: InvitationRow[] = [];
  let sequence = 0;
  const next = () => `id-${++sequence}`;
  const prisma = {
    user: {
      findUnique: ({ where }: { where: { authSubject: string } }) =>
        Promise.resolve(
          users.find((user) => user.authSubject === where.authSubject) ?? null,
        ),
      upsert: ({ create }: { create: Omit<UserRow, 'id'> }) => {
        const row = { id: next(), ...create };
        users.push(row);
        return Promise.resolve(row);
      },
      findUniqueOrThrow: ({ where }: { where: { id: string } }) => {
        const user = users.find((item) => item.id === where.id);
        if (!user) throw new Error('no user');
        return Promise.resolve({
          ...user,
          memberships: memberships
            .filter((item) => item.userId === user.id)
            .map((item) => ({
              ...item,
              organization: organizations.get(item.organizationId),
            })),
        });
      },
    },
    invitation: {
      findMany: ({
        where,
      }: {
        where: { email?: string; organizationId?: string; acceptedAt: null };
      }) =>
        Promise.resolve(
          invitations.filter(
            (item) =>
              item.acceptedAt === null &&
              (where.email === undefined || item.email === where.email) &&
              (where.organizationId === undefined ||
                item.organizationId === where.organizationId),
          ),
        ),
      upsert: ({
        create,
        update,
      }: {
        create: { organizationId: string; email: string; role: string };
        update: { role: string };
      }) => {
        const found = invitations.find(
          (item) =>
            item.organizationId === create.organizationId &&
            item.email === create.email,
        );
        if (found) {
          Object.assign(found, update, { acceptedAt: null });
          return Promise.resolve(found);
        }
        const row = {
          id: next(),
          ...create,
          createdAt: new Date(),
          acceptedAt: null,
        };
        invitations.push(row);
        return Promise.resolve(row);
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { id: { in: string[] } };
        data: { acceptedAt: Date };
      }) => {
        for (const item of invitations) {
          if (where.id.in.includes(item.id)) item.acceptedAt = data.acceptedAt;
        }
        return Promise.resolve({ count: where.id.in.length });
      },
    },
    membership: {
      upsert: ({
        create,
      }: {
        create: { organizationId: string; userId: string; role: string };
      }) => {
        const found = memberships.find(
          (item) =>
            item.organizationId === create.organizationId &&
            item.userId === create.userId,
        );
        if (found) {
          found.role = create.role;
          return Promise.resolve(found);
        }
        const row = { ...create, createdAt: new Date() };
        memberships.push(row);
        return Promise.resolve(row);
      },
      findFirst: ({
        where,
      }: {
        where: { organizationId: string; user: { email: string } };
      }) =>
        Promise.resolve(
          memberships.find(
            (item) =>
              item.organizationId === where.organizationId &&
              users.find((user) => user.id === item.userId)?.email ===
                where.user.email,
          ) ?? null,
        ),
      findMany: ({ where }: { where: { organizationId: string } }) =>
        Promise.resolve(
          memberships
            .filter((item) => item.organizationId === where.organizationId)
            .map((item) => ({
              ...item,
              user: users.find((user) => user.id === item.userId),
            })),
        ),
    },
    project: {
      findMany: ({ where }: { where: { organizationId: { in: string[] } } }) =>
        Promise.resolve(
          projects.filter((project) =>
            where.organizationId.in.includes(project.organizationId),
          ),
        ),
    },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  return { prisma: prisma as unknown as PrismaClient, invitations, users };
};

const identityFor = (
  subjects: Record<string, string>,
  profiles: Record<string, Profile>,
): Identity => ({
  verify: (token) => {
    const subject = subjects[token];
    return subject
      ? Promise.resolve({ subject })
      : Promise.reject(new InvalidTokenError('firma inválida'));
  },
  profile: (token) => {
    const profile = profiles[token];
    return profile
      ? Promise.resolve(profile)
      : Promise.reject(new InvalidTokenError('sin perfil'));
  },
});

const PAULA: Profile = {
  email: 'paula.rojas@calculo.example',
  emailVerified: true,
  name: 'Paula Rojas',
};

const statusOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof HttpException
      ? { status: error.getStatus(), body: error.getResponse() }
      : error;
  }
};

const setup = (
  profiles: Record<string, Profile> = { paula: PAULA },
  superadmins: readonly string[] = [],
) => {
  const db = fakeDb();
  const subjects = Object.fromEntries(
    Object.keys(profiles).map((token) => [token, `email|${token}`]),
  );
  return {
    ...db,
    service: new AccountsService(
      db.prisma,
      identityFor(subjects, profiles),
      superadmins,
    ),
  };
};

describe('AccountsService.authenticate', () => {
  it('sin Auth0 configurado responde 503', async () => {
    const service = new AccountsService(fakeDb().prisma, null);
    expect(await statusOf(service.authenticate('x'))).toMatchObject({
      status: 503,
      body: { code: 'auth_not_configured' },
    });
  });

  it('un token inválido es 401', async () => {
    const { service } = setup();
    expect(await statusOf(service.authenticate('falso'))).toMatchObject({
      status: 401,
      body: { code: 'invalid_token' },
    });
  });

  it('la primera vez registra a la persona con su correo y sin organizaciones', async () => {
    const { service, users } = setup();
    const account = await service.authenticate('paula');
    expect(account).toMatchObject({
      email: 'paula.rojas@calculo.example',
      name: 'Paula Rojas',
      memberships: [],
    });
    await service.authenticate('paula');
    expect(users).toHaveLength(1);
  });

  it('un correo sin confirmar no entra', async () => {
    const { service } = setup({
      paula: { ...PAULA, emailVerified: false },
    });
    expect(await statusOf(service.authenticate('paula'))).toMatchObject({
      status: 403,
      body: { code: 'email_not_verified' },
    });
  });

  it('al entrar acepta las invitaciones a su correo, también las que llegan después', async () => {
    const { service, invitations } = setup();
    await service.invite('aromos', 'Paula.Rojas@calculo.example', 'admin');
    const first = await service.authenticate('paula');
    expect(first.memberships).toEqual([
      {
        organizationId: 'aromos',
        organizationName: 'Inmobiliaria Los Aromos',
        role: 'admin',
      },
    ]);
    expect(invitations[0]?.acceptedAt).toBeInstanceOf(Date);
    await service.invite('otra', PAULA.email, 'member');
    const second = await service.authenticate('paula');
    expect(second.memberships.map((item) => item.role)).toEqual([
      'admin',
      'member',
    ]);
  });
});

describe('roles y proyectos', () => {
  const memberOf = (role: 'admin' | 'member'): Account => ({
    id: 'u1',
    email: PAULA.email,
    name: null,
    superadmin: false,
    memberships: [
      {
        organizationId: 'aromos',
        organizationName: 'Inmobiliaria Los Aromos',
        role,
      },
    ],
  });

  it('ve solo los proyectos de sus organizaciones', async () => {
    const { service } = setup();
    const projects = await service.projects(memberOf('member'));
    expect(projects.map((project) => project.id)).toEqual(['los-aromos']);
  });

  it('un miembro ve su organización pero no invita; un administrador sí', () => {
    const { service } = setup();
    expect(() =>
      service.requireMember(memberOf('member'), 'aromos'),
    ).not.toThrow();
    expect(() => service.requireAdmin(memberOf('member'), 'aromos')).toThrow(
      /administrador/,
    );
    expect(() =>
      service.requireAdmin(memberOf('admin'), 'aromos'),
    ).not.toThrow();
  });

  it('nadie entra a una organización ajena', () => {
    const { service } = setup();
    expect(() => service.requireMember(memberOf('admin'), 'otra')).toThrow(
      /No eres parte/,
    );
  });

  it('no se invita a quien ya es miembro', async () => {
    const { service } = setup();
    await service.invite('aromos', PAULA.email, 'member');
    await service.authenticate('paula');
    expect(
      await statusOf(service.invite('aromos', PAULA.email, 'admin')),
    ).toMatchObject({ status: 409, body: { code: 'already_member' } });
  });
});

describe('superadmin', () => {
  it('es superadmin quien entra con un correo de SUPERADMIN_EMAILS, sin importar mayúsculas', async () => {
    const { service } = setup({ paula: PAULA }, [
      ' Paula.Rojas@Calculo.example ',
    ]);
    const account = await service.authenticate('paula');
    expect(account.superadmin).toBe(true);
    expect(() => service.requireSuperadmin(account)).not.toThrow();
  });

  it('nadie más lo es, ni siquiera un administrador de una organización', async () => {
    const { service } = setup({ paula: PAULA }, ['otra@vigente.example']);
    await service.invite('aromos', PAULA.email, 'admin');
    const account = await service.authenticate('paula');
    expect(account.superadmin).toBe(false);
    expect(() => service.requireSuperadmin(account)).toThrow(/superadmin/);
  });
});
