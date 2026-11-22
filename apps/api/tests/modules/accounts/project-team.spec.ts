import { HttpException } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import type { Account } from '../../../src/modules/accounts/accounts.service.ts';
import {
  projectChangesBody,
  teamMemberBody,
} from '../../../src/modules/accounts/projects.controller.ts';
import {
  ProjectsService,
  TEAM_ROLE,
} from '../../../src/modules/accounts/projects.service.ts';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const CREATOR = '22222222-2222-4222-8222-222222222222';
const MEMBER = '33333333-3333-4333-8333-333333333333';
const OUTSIDER = '44444444-4444-4444-8444-444444444444';

interface Member {
  projectId: string;
  id: string;
  position: number;
  name: string;
  role: string;
  channel: string;
  handle: string;
}

const fakeDb = () => {
  const projects = [
    {
      id: 'mut',
      organizationId: 'cordillera',
      name: 'MUT',
      location: 'Las Condes',
      description: '',
      authorId: CREATOR,
      costOwnerId: CREATOR,
      scheduleOwnerId: CREATOR,
      createdAt: new Date('2026-11-22T05:00:00Z'),
    },
    {
      id: 'torre',
      organizationId: 'cordillera',
      name: 'Torre Norte',
      location: '',
      description: '',
      authorId: ADMIN,
      costOwnerId: ADMIN,
      scheduleOwnerId: ADMIN,
      createdAt: new Date('2026-11-22T05:00:00Z'),
    },
  ];
  const users = new Map([
    [ADMIN, { id: ADMIN, email: 'admin@cordillera.test', name: 'Ana Admin' }],
    [CREATOR, { id: CREATOR, email: 'creador@cordillera.test', name: null }],
    [
      MEMBER,
      { id: MEMBER, email: 'bruno@cordillera.test', name: 'Bruno Díaz' },
    ],
  ]);
  const memberships = [ADMIN, CREATOR, MEMBER].map((userId) => ({
    organizationId: 'cordillera',
    userId,
  }));
  const members: Member[] = [
    {
      projectId: 'mut',
      id: CREATOR,
      position: 0,
      name: 'creador@cordillera.test',
      role: 'Creador del proyecto',
      channel: 'email',
      handle: 'creador@cordillera.test',
    },
  ];
  const documents: { projectId: string; ownerId: string }[] = [];
  const prisma = {
    project: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(projects.find((item) => item.id === where.id) ?? null),
      findMany: ({
        where,
      }: {
        where: { organizationId: string; id: { not: string } };
      }) =>
        Promise.resolve(
          projects.filter(
            (item) =>
              item.organizationId === where.organizationId &&
              item.id !== where.id.not,
          ),
        ),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, string>;
      }) => {
        const project = projects.find((item) => item.id === where.id);
        if (!project) throw new Error('sin proyecto');
        Object.assign(project, data);
        return Promise.resolve({
          ...project,
          organization: { name: 'Constructora Cordillera' },
        });
      },
    },
    membership: {
      findUnique: ({
        where,
      }: {
        where: {
          organizationId_userId: { organizationId: string; userId: string };
        };
      }) => {
        const { organizationId, userId } = where.organizationId_userId;
        const found = memberships.find(
          (item) =>
            item.organizationId === organizationId && item.userId === userId,
        );
        return Promise.resolve(
          found ? { ...found, user: users.get(userId) } : null,
        );
      },
    },
    projectMember: {
      findMany: ({ where }: { where: { projectId: string } }) =>
        Promise.resolve(
          members
            .filter((item) => item.projectId === where.projectId)
            .sort((a, b) => a.position - b.position),
        ),
      findUnique: ({
        where,
      }: {
        where: { projectId_id: { projectId: string; id: string } };
      }) =>
        Promise.resolve(
          members.find(
            (item) =>
              item.projectId === where.projectId_id.projectId &&
              item.id === where.projectId_id.id,
          ) ?? null,
        ),
      aggregate: ({ where }: { where: { projectId: string } }) => {
        const positions = members
          .filter((item) => item.projectId === where.projectId)
          .map((item) => item.position);
        return Promise.resolve({
          _max: { position: positions.length ? Math.max(...positions) : null },
        });
      },
      create: ({ data }: { data: Member }) => {
        members.push(data);
        return Promise.resolve(data);
      },
      deleteMany: ({ where }: { where: { projectId: string; id: string } }) => {
        const index = members.findIndex(
          (item) => item.projectId === where.projectId && item.id === where.id,
        );
        if (index >= 0) members.splice(index, 1);
        return Promise.resolve({ count: index >= 0 ? 1 : 0 });
      },
    },
    projectSpace: { count: () => Promise.resolve(0) },
    projectDocument: {
      count: ({ where }: { where: { projectId: string; ownerId: string } }) =>
        Promise.resolve(
          documents.filter(
            (item) =>
              item.projectId === where.projectId &&
              item.ownerId === where.ownerId,
          ).length,
        ),
    },
  };
  return {
    service: new ProjectsService(prisma as unknown as PrismaClient),
    projects,
    members,
    documents,
  };
};

const account = (
  id: string,
  role: 'admin' | 'member' | null = 'member',
): Account => ({
  id,
  email: `${id}@cordillera.test`,
  name: null,
  superadmin: false,
  memberships: role
    ? [
        {
          organizationId: 'cordillera',
          organizationName: 'Constructora Cordillera',
          role,
        },
      ]
    : [],
});

const admin = account(ADMIN, 'admin');
const creator = account(CREATOR);
const member = account(MEMBER);
const outsider = account(OUTSIDER, null);

const failure = async (work: Promise<unknown>) => {
  const error: unknown = await work.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpException);
  const http = error as HttpException;
  return {
    status: http.getStatus(),
    code: (http.getResponse() as { code?: string }).code,
  };
};

describe('editar un proyecto', () => {
  it('un admin de la organización cambia el nombre, el lugar y la descripción', async () => {
    const { service } = fakeDb();
    const updated = await service.update(admin, 'mut', {
      name: 'MUT Fase 2',
      description: 'Oficinas y comercio',
    });
    expect(updated).toMatchObject({
      id: 'mut',
      name: 'MUT Fase 2',
      location: 'Las Condes',
      description: 'Oficinas y comercio',
      organizationName: 'Constructora Cordillera',
    });
  });

  it('quien creó el proyecto también lo edita, otro miembro no', async () => {
    const { service } = fakeDb();
    await expect(
      service.update(creator, 'mut', { location: 'Providencia' }),
    ).resolves.toMatchObject({ location: 'Providencia' });
    expect(
      await failure(service.update(member, 'mut', { location: 'x' })),
    ).toEqual({ status: 403, code: 'project_admin_required' });
  });

  it('el nombre no se repite en la organización, pero puede quedar igual', async () => {
    const { service } = fakeDb();
    expect(
      await failure(service.update(admin, 'mut', { name: ' torre  norte ' })),
    ).toEqual({ status: 409, code: 'project_name_taken' });
    await expect(
      service.update(admin, 'mut', { name: 'mut' }),
    ).resolves.toMatchObject({ name: 'mut' });
  });

  it('un proyecto de otra organización no existe para quien no es de ella', async () => {
    const { service } = fakeDb();
    expect(
      await failure(service.update(outsider, 'mut', { name: 'x' })),
    ).toEqual({ status: 404, code: 'not_found' });
  });
});

describe('el equipo del proyecto', () => {
  it('lista el equipo, marca a quien lo creó y dice si puedes manejarlo', async () => {
    const { service } = fakeDb();
    const team = await service.team(member, 'mut');
    expect(team.canManage).toBe(false);
    expect(team.members).toEqual([
      {
        userId: CREATOR,
        name: 'creador@cordillera.test',
        role: 'Creador del proyecto',
        email: 'creador@cordillera.test',
        author: true,
      },
    ]);
    expect((await service.team(admin, 'mut')).canManage).toBe(true);
  });

  it('suma a alguien de la organización con su rol, o «Equipo» si no lo dice', async () => {
    const { service, members } = fakeDb();
    await expect(
      service.addToTeam(creator, 'mut', { userId: MEMBER, role: 'Calculista' }),
    ).resolves.toEqual({
      userId: MEMBER,
      name: 'Bruno Díaz',
      role: 'Calculista',
      email: 'bruno@cordillera.test',
      author: false,
    });
    await service.addToTeam(admin, 'mut', { userId: ADMIN });
    expect(members.map((item) => [item.id, item.position, item.role])).toEqual([
      [CREATOR, 0, 'Creador del proyecto'],
      [MEMBER, 1, 'Calculista'],
      [ADMIN, 2, TEAM_ROLE],
    ]);
  });

  it('no suma a alguien de fuera, ni dos veces, ni lo hace un miembro cualquiera', async () => {
    const { service } = fakeDb();
    expect(
      await failure(service.addToTeam(admin, 'mut', { userId: OUTSIDER })),
    ).toEqual({ status: 422, code: 'not_in_organization' });
    expect(
      await failure(service.addToTeam(admin, 'mut', { userId: CREATOR })),
    ).toEqual({ status: 409, code: 'already_on_team' });
    expect(
      await failure(service.addToTeam(member, 'mut', { userId: MEMBER })),
    ).toEqual({ status: 403, code: 'project_admin_required' });
  });

  it('quita a alguien del equipo, salvo a quien lo creó o a un dueño de documentos', async () => {
    const { service, members, documents } = fakeDb();
    await service.addToTeam(admin, 'mut', { userId: MEMBER });
    await service.addToTeam(admin, 'mut', { userId: ADMIN });
    expect(
      await failure(service.removeFromTeam(admin, 'mut', CREATOR)),
    ).toEqual({ status: 409, code: 'project_owner' });
    documents.push({ projectId: 'mut', ownerId: ADMIN });
    expect(await failure(service.removeFromTeam(admin, 'mut', ADMIN))).toEqual({
      status: 409,
      code: 'owns_documents',
    });
    await service.removeFromTeam(admin, 'mut', MEMBER);
    expect(members.map((item) => item.id)).toEqual([CREATOR, ADMIN]);
    expect(await failure(service.removeFromTeam(admin, 'mut', MEMBER))).toEqual(
      { status: 404, code: 'not_found' },
    );
  });
});

describe('los cuerpos de las rutas', () => {
  it('editar pide al menos un campo y recorta los textos', () => {
    expect(projectChangesBody.safeParse({}).success).toBe(false);
    expect(projectChangesBody.safeParse({ name: '   ' }).success).toBe(false);
    expect(
      projectChangesBody.parse({ description: '  Oficinas  ', location: '' }),
    ).toEqual({ description: 'Oficinas', location: '' });
  });

  it('sumar al equipo pide el id de la cuenta y un rol opcional', () => {
    expect(teamMemberBody.safeParse({ userId: 'nadie' }).success).toBe(false);
    expect(
      teamMemberBody.parse({ userId: MEMBER, role: ' Calculista ' }),
    ).toEqual({ userId: MEMBER, role: 'Calculista' });
  });
});
