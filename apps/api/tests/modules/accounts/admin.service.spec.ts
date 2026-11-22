import { HttpException } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { AccountsService } from '../../../src/modules/accounts/accounts.service.ts';
import { AdminService } from '../../../src/modules/accounts/admin.service.ts';

interface OrganizationRow {
  id: string;
  name: string;
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
  const organizations: OrganizationRow[] = [
    {
      id: 'inmobiliaria-los-aromos',
      name: 'Inmobiliaria Los Aromos',
      createdAt: new Date('2026-01-01'),
    },
  ];
  const users = [
    {
      id: 'u1',
      email: 'paula.rojas@calculo.example',
      name: 'Paula Rojas',
      createdAt: new Date('2026-01-02'),
    },
    {
      id: 'u2',
      email: 'sin.equipo@vigente.example',
      name: null,
      createdAt: new Date('2026-01-03'),
    },
  ];
  const memberships = [
    {
      organizationId: 'inmobiliaria-los-aromos',
      userId: 'u1',
      role: 'admin',
      createdAt: new Date('2026-01-02'),
    },
  ];
  const invitations: InvitationRow[] = [];
  const organizationOf = (id: string) =>
    organizations.find((item) => item.id === id);
  let sequence = 0;
  const prisma = {
    user: {
      findMany: () =>
        Promise.resolve(
          users.map((user) => ({
            ...user,
            memberships: memberships
              .filter((item) => item.userId === user.id)
              .map((item) => ({
                ...item,
                organization: organizationOf(item.organizationId),
              })),
          })),
        ),
    },
    organization: {
      findMany: ({
        where,
        include,
      }: {
        where?: { id: { startsWith: string } };
        include?: unknown;
      }) =>
        Promise.resolve(
          organizations
            .filter((item) => !where || item.id.startsWith(where.id.startsWith))
            .map((item) =>
              include
                ? {
                    ...item,
                    _count: {
                      memberships: memberships.filter(
                        (row) => row.organizationId === item.id,
                      ).length,
                      projects: item.id === 'inmobiliaria-los-aromos' ? 1 : 0,
                    },
                  }
                : item,
            ),
        ),
      findFirst: ({
        where,
      }: {
        where: { name: { equals: string; mode: 'insensitive' } };
      }) =>
        Promise.resolve(
          organizations.find(
            (item) =>
              item.name.toLowerCase() === where.name.equals.toLowerCase(),
          ) ?? null,
        ),
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(organizationOf(where.id) ?? null),
      create: ({ data }: { data: { id: string; name: string } }) => {
        const row = { ...data, createdAt: new Date() };
        organizations.push(row);
        return Promise.resolve(row);
      },
    },
    membership: {
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
    },
    invitation: {
      findMany: () =>
        Promise.resolve(
          invitations
            .filter((item) => item.acceptedAt === null)
            .map((item) => ({
              ...item,
              organization: organizationOf(item.organizationId),
            })),
        ),
      upsert: ({
        create,
      }: {
        create: { organizationId: string; email: string; role: string };
      }) => {
        const row = {
          id: `inv-${++sequence}`,
          ...create,
          createdAt: new Date(),
          acceptedAt: null,
        };
        invitations.push(row);
        return Promise.resolve(row);
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, organizations };
};

const setup = () => {
  const db = fakeDb();
  const accounts = new AccountsService(db.prisma, null);
  return { ...db, admin: new AdminService(db.prisma, accounts) };
};

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof HttpException
      ? { status: error.getStatus(), body: error.getResponse() }
      : error;
  }
};

describe('AdminService.users', () => {
  it('lista a todos los usuarios con sus organizaciones y las invitaciones pendientes', async () => {
    const { admin } = setup();
    await admin.invite(
      'inmobiliaria-los-aromos',
      'Nueva.Persona@cliente.example',
      'member',
    );
    const { users, invitations } = await admin.users();
    expect(
      users.map((user) => [user.email, user.organizations.map((o) => o.role)]),
    ).toEqual([
      ['paula.rojas@calculo.example', ['admin']],
      ['sin.equipo@vigente.example', []],
    ]);
    expect(invitations).toMatchObject([
      {
        email: 'nueva.persona@cliente.example',
        organizationName: 'Inmobiliaria Los Aromos',
        role: 'member',
      },
    ]);
  });
});

describe('AdminService.createOrganization', () => {
  it('crea la organización con un id legible y sin miembros', async () => {
    const { admin } = setup();
    const created = await admin.createOrganization('Constructora Andes');
    expect(created).toMatchObject({
      id: 'constructora-andes',
      name: 'Constructora Andes',
      members: 0,
      projects: 0,
    });
    const { organizations } = await admin.organizations();
    expect(organizations.map((item) => [item.id, item.members])).toEqual([
      ['inmobiliaria-los-aromos', 1],
      ['constructora-andes', 0],
    ]);
  });

  it('no repite el nombre de ninguna organización, sin contar mayúsculas, tildes ni espacios de más', async () => {
    const { admin, organizations } = setup();
    expect(
      await errorOf(admin.createOrganization('  inmobiliaria  los Áromos ')),
    ).toMatchObject({ status: 409, body: { code: 'organization_name_taken' } });
    expect(organizations).toHaveLength(1);
  });

  it('el id de la organización nueva sale del nombre', async () => {
    const { admin } = setup();
    const created = await admin.createOrganization('Constructora Ñuñoa & Cía.');
    expect(created.id).toBe('constructora-nunoa-cia');
  });

  it('si el id ya está tomado, le agrega un número', async () => {
    const { admin, organizations } = setup();
    organizations.push({
      id: 'andes',
      name: 'Andes SpA',
      createdAt: new Date(),
    });
    const created = await admin.createOrganization('Andes');
    expect(created.id).toBe('andes-2');
  });
});

describe('AdminService.invite', () => {
  it('invita un correo a cualquier organización, sin ser parte de ella', async () => {
    const { admin } = setup();
    const { id } = await admin.createOrganization('Constructora Andes');
    const invitation = await admin.invite(id, 'jefa@andes.example', 'admin');
    expect(invitation).toMatchObject({
      email: 'jefa@andes.example',
      role: 'admin',
      organizationId: 'constructora-andes',
      organizationName: 'Constructora Andes',
    });
  });

  it('una organización que no existe es 404', async () => {
    const { admin } = setup();
    expect(
      await errorOf(admin.invite('no-existe', 'x@y.example', 'member')),
    ).toMatchObject({ status: 404, body: { code: 'organization_not_found' } });
  });

  it('no invita a quien ya es miembro', async () => {
    const { admin } = setup();
    expect(
      await errorOf(
        admin.invite(
          'inmobiliaria-los-aromos',
          'paula.rojas@calculo.example',
          'member',
        ),
      ),
    ).toMatchObject({ status: 409, body: { code: 'already_member' } });
  });
});
