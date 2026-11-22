import { HttpException } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import {
  type Account,
  AccountsService,
  CREATOR_ROLE,
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

interface ProjectCreate {
  id: string;
  organizationId: string;
  name: string;
  location: string;
  description: string;
  authorId: string;
  costOwnerId: string;
  scheduleOwnerId: string;
  modelDocumentId: string | null;
  longitudinalAxes: unknown[];
  transversalAxes: number[];
  members: { create: Record<string, unknown>[] };
}

const fakeDb = () => {
  const organizations = new Map([
    ['aromos', { id: 'aromos', name: 'Inmobiliaria Los Aromos' }],
    ['otra', { id: 'otra', name: 'Otra Constructora' }],
    ['vacia', { id: 'vacia', name: 'Constructora Vacía' }],
  ]);
  const projects = [
    { id: 'los-aromos', organizationId: 'aromos', name: 'Edificio Los Aromos' },
    { id: 'torre', organizationId: 'otra', name: 'Torre Ajena' },
  ].map((project) => ({ ...project, location: '', description: '' }));
  const users: UserRow[] = [];
  const memberships: MembershipRow[] = [];
  const invitations: InvitationRow[] = [];
  const created: ProjectCreate[] = [];
  let sequence = 0;
  const next = () => `id-${++sequence}`;
  const prisma = {
    organization: {
      findMany: ({ where }: { where: { id: { startsWith: string } } }) =>
        Promise.resolve(
          [...organizations.keys()]
            .filter((id) => id.startsWith(where.id.startsWith))
            .map((id) => ({ id })),
        ),
      create: ({
        data,
      }: {
        data: {
          id: string;
          name: string;
          memberships: { create: { userId: string; role: string } };
        };
      }) => {
        organizations.set(data.id, { id: data.id, name: data.name });
        memberships.push({
          organizationId: data.id,
          ...data.memberships.create,
          createdAt: new Date(),
        });
        return Promise.resolve({ id: data.id, name: data.name });
      },
      delete: ({ where }: { where: { id: string } }) => {
        organizations.delete(where.id);
        for (let index = memberships.length - 1; index >= 0; index -= 1) {
          if (memberships[index]?.organizationId === where.id) {
            memberships.splice(index, 1);
          }
        }
        return Promise.resolve({ id: where.id });
      },
    },
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
      findFirst: ({ where }: { where: { email: string; acceptedAt: null } }) =>
        Promise.resolve(
          invitations.find(
            (item) => item.acceptedAt === null && item.email === where.email,
          ) ?? null,
        ),
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
      count: ({ where }: { where: { organizationId: string } }) =>
        Promise.resolve(
          projects.filter(
            (project) => project.organizationId === where.organizationId,
          ).length,
        ),
      findMany: ({
        where,
      }: {
        where: {
          organizationId?: { in: string[] };
          id?: { startsWith: string };
        };
      }) =>
        Promise.resolve(
          projects.filter(
            (project) =>
              (where.organizationId === undefined ||
                where.organizationId.in.includes(project.organizationId)) &&
              (where.id === undefined ||
                project.id.startsWith(where.id.startsWith)),
          ),
        ),
      findUnique: ({ where }: { where: { id: string } }) => {
        const project = projects.find((item) => item.id === where.id);
        return Promise.resolve(
          project
            ? {
                ...project,
                createdAt: new Date(),
                organization: organizations.get(project.organizationId),
              }
            : null,
        );
      },
      create: ({ data }: { data: ProjectCreate }) => {
        created.push(data);
        const row = {
          id: data.id,
          organizationId: data.organizationId,
          name: data.name,
          location: data.location,
          description: data.description,
        };
        projects.push(row);
        return Promise.resolve(row);
      },
    },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  return {
    prisma: prisma as unknown as PrismaClient,
    organizations,
    memberships,
    invitations,
    users,
    created,
  };
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

  it('sin invitación no entra ni queda registrada', async () => {
    const { service, users } = setup();
    expect(await statusOf(service.authenticate('paula'))).toMatchObject({
      status: 403,
      body: { code: 'not_invited' },
    });
    expect(users).toHaveLength(0);
  });

  it('la primera vez, con una invitación, registra a la persona con su correo', async () => {
    const { service, users } = setup();
    await service.invite('aromos', PAULA.email, 'member');
    const account = await service.authenticate('paula');
    expect(account).toMatchObject({
      email: 'paula.rojas@calculo.example',
      name: 'Paula Rojas',
      memberships: [{ organizationId: 'aromos', role: 'member' }],
    });
    await service.authenticate('paula');
    expect(users).toHaveLength(1);
  });

  it('quien quedó registrado sin organización tampoco entra', async () => {
    const { service, users } = setup();
    users.push({
      id: 'u0',
      authSubject: 'email|paula',
      email: PAULA.email,
      name: PAULA.name,
    });
    expect(await statusOf(service.authenticate('paula'))).toMatchObject({
      status: 403,
      body: { code: 'not_invited' },
    });
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

  it('entra a un proyecto de su organización y no a uno ajeno', async () => {
    const { service } = setup();
    await expect(
      service.requireProject(memberOf('member'), 'los-aromos'),
    ).resolves.toBeUndefined();
    await expect(
      service.requireProject(memberOf('admin'), 'torre'),
    ).rejects.toMatchObject({ response: { code: 'not_found' } });
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

  it('un miembro crea un proyecto en su organización, con su id libre y él como autor', async () => {
    const { service, created } = setup();
    const account = memberOf('member');
    const project = await service.createProject(account, {
      organizationId: 'aromos',
      name: 'Los Aromos',
      location: 'Ñuñoa',
      description: '',
    });
    expect(project).toEqual({
      id: 'los-aromos-2',
      organizationId: 'aromos',
      name: 'Los Aromos',
      location: 'Ñuñoa',
      description: '',
    });
    expect(created[0]).toMatchObject({
      authorId: 'u1',
      costOwnerId: 'u1',
      scheduleOwnerId: 'u1',
      modelDocumentId: null,
      longitudinalAxes: [],
      transversalAxes: [],
      members: {
        create: [
          {
            id: 'u1',
            name: PAULA.email,
            role: CREATOR_ROLE,
            channel: 'email',
            handle: PAULA.email,
          },
        ],
      },
    });
    const listed = await service.projects(account);
    expect(listed.map((item) => item.id)).toEqual([
      'los-aromos',
      'los-aromos-2',
    ]);
    expect(await service.project(account, 'los-aromos-2')).toMatchObject({
      id: 'los-aromos-2',
      organizationName: 'Inmobiliaria Los Aromos',
    });
  });

  it('no se crea un proyecto con el nombre de otro de la misma organización', async () => {
    const { service, created } = setup();
    for (const name of ['Edificio Los Aromos', '  edificio  los  Áromos ']) {
      expect(
        await statusOf(
          service.createProject(memberOf('member'), {
            organizationId: 'aromos',
            name,
            location: '',
            description: '',
          }),
        ),
      ).toMatchObject({ status: 409, body: { code: 'project_name_taken' } });
    }
    expect(created).toHaveLength(0);
  });

  it('nadie crea un proyecto en una organización ajena', async () => {
    const { service, created } = setup();
    expect(
      await statusOf(
        service.createProject(memberOf('admin'), {
          organizationId: 'otra',
          name: 'Intruso',
          location: '',
          description: '',
        }),
      ),
    ).toMatchObject({ status: 403, body: { code: 'not_a_member' } });
    expect(created).toHaveLength(0);
  });

  it('un proyecto ajeno o que no existe no se abre', async () => {
    const { service } = setup();
    for (const id of ['torre', 'nada']) {
      expect(
        await statusOf(service.project(memberOf('member'), id)),
      ).toMatchObject({ status: 404, body: { code: 'not_found' } });
    }
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

describe('organizaciones', () => {
  const NAMES: Record<string, string> = {
    aromos: 'Inmobiliaria Los Aromos',
    vacia: 'Constructora Vacía',
  };

  const accountWith = (
    ...memberships: [string, 'admin' | 'member'][]
  ): Account => ({
    id: 'u1',
    email: PAULA.email,
    name: null,
    superadmin: false,
    memberships: memberships.map(([organizationId, role]) => ({
      organizationId,
      organizationName: NAMES[organizationId] ?? organizationId,
      role,
    })),
  });

  it('un administrador crea una organización y queda como su administrador', async () => {
    const { service, organizations, memberships } = setup();
    const created = await service.createOrganization(
      accountWith(['aromos', 'admin']),
      'Constructora Sur',
    );
    expect(created).toEqual({
      organizationId: 'constructora-sur',
      organizationName: 'Constructora Sur',
      role: 'admin',
    });
    expect(organizations.get('constructora-sur')?.name).toBe(
      'Constructora Sur',
    );
    expect(memberships).toContainEqual(
      expect.objectContaining({
        organizationId: 'constructora-sur',
        userId: 'u1',
        role: 'admin',
      }),
    );
  });

  it('la nueva organización toma el primer id libre', async () => {
    const { service } = setup();
    const created = await service.createOrganization(
      accountWith(['aromos', 'admin']),
      'Otra',
    );
    expect(created.organizationId).toBe('otra-2');
  });

  it('un miembro no crea organizaciones', async () => {
    const { service, organizations } = setup();
    expect(
      await statusOf(
        service.createOrganization(accountWith(['aromos', 'member']), 'Sur'),
      ),
    ).toMatchObject({ status: 403, body: { code: 'admin_required' } });
    expect(organizations.has('sur')).toBe(false);
  });

  it('no repite el nombre de una organización de la que ya eres parte', async () => {
    const { service } = setup();
    expect(
      await statusOf(
        service.createOrganization(
          accountWith(['aromos', 'admin']),
          '  inmobiliaria  los Áromos ',
        ),
      ),
    ).toMatchObject({ status: 409, body: { code: 'organization_name_taken' } });
  });

  it('un administrador elimina una organización sin proyectos, con su equipo', async () => {
    const { service, organizations, memberships } = setup();
    memberships.push({
      organizationId: 'vacia',
      userId: 'u1',
      role: 'admin',
      createdAt: new Date(),
    });
    await service.deleteOrganization(
      accountWith(['aromos', 'admin'], ['vacia', 'admin']),
      'vacia',
    );
    expect(organizations.has('vacia')).toBe(false);
    expect(memberships.some((item) => item.organizationId === 'vacia')).toBe(
      false,
    );
  });

  it('un miembro no elimina la organización', async () => {
    const { service, organizations } = setup();
    expect(
      await statusOf(
        service.deleteOrganization(
          accountWith(['aromos', 'admin'], ['vacia', 'member']),
          'vacia',
        ),
      ),
    ).toMatchObject({ status: 403, body: { code: 'admin_required' } });
    expect(organizations.has('vacia')).toBe(true);
  });

  it('no se elimina una organización con proyectos', async () => {
    const { service, organizations } = setup();
    expect(
      await statusOf(
        service.deleteOrganization(
          accountWith(['aromos', 'admin'], ['vacia', 'admin']),
          'aromos',
        ),
      ),
    ).toMatchObject({
      status: 409,
      body: { code: 'organization_has_projects' },
    });
    expect(organizations.has('aromos')).toBe(true);
  });

  it('no se elimina tu única organización', async () => {
    const { service, organizations } = setup();
    expect(
      await statusOf(
        service.deleteOrganization(accountWith(['vacia', 'admin']), 'vacia'),
      ),
    ).toMatchObject({ status: 409, body: { code: 'last_organization' } });
    expect(organizations.has('vacia')).toBe(true);
  });
});

describe('superadmin', () => {
  it('es superadmin quien entra con un correo de SUPERADMIN_EMAILS, sin importar mayúsculas', async () => {
    const { service } = setup({ paula: PAULA }, [
      ' Paula.Rojas@Calculo.example ',
    ]);
    await service.invite('aromos', PAULA.email, 'member');
    const account = await service.authenticate('paula');
    expect(account.superadmin).toBe(true);
    expect(() => service.requireSuperadmin(account)).not.toThrow();
  });

  it('un superadmin entra sin invitación y sin organizaciones', async () => {
    const { service, users } = setup({ paula: PAULA }, [PAULA.email]);
    const account = await service.authenticate('paula');
    expect(account).toMatchObject({ superadmin: true, memberships: [] });
    await service.authenticate('paula');
    expect(users).toHaveLength(1);
  });

  it('nadie más lo es, ni siquiera un administrador de una organización', async () => {
    const { service } = setup({ paula: PAULA }, ['otra@vigente.example']);
    await service.invite('aromos', PAULA.email, 'admin');
    const account = await service.authenticate('paula');
    expect(account.superadmin).toBe(false);
    expect(() => service.requireSuperadmin(account)).toThrow(/superadmin/);
  });

  it('sin invitación, quien no es superadmin sigue sin entrar', async () => {
    const { service, users } = setup({ paula: PAULA }, [
      'otra@vigente.example',
    ]);
    expect(await statusOf(service.authenticate('paula'))).toMatchObject({
      status: 403,
      body: { code: 'not_invited' },
    });
    expect(users).toHaveLength(0);
  });

  it('un superadmin con el correo sin confirmar tampoco entra', async () => {
    const { service, users } = setup(
      { paula: { ...PAULA, emailVerified: false } },
      [PAULA.email],
    );
    expect(await statusOf(service.authenticate('paula'))).toMatchObject({
      status: 403,
      body: { code: 'email_not_verified' },
    });
    expect(users).toHaveLength(0);
  });

  it('un superadmin que ya es parte de organizaciones conserva sus membresías', async () => {
    const { service } = setup({ paula: PAULA }, [PAULA.email]);
    await service.invite('aromos', PAULA.email, 'admin');
    expect(await service.authenticate('paula')).toMatchObject({
      superadmin: true,
      memberships: [{ organizationId: 'aromos', role: 'admin' }],
    });
  });
});
