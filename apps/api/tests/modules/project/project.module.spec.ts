import type { PrismaClient, ProjectDefinition } from '@team27/data-main';
import { LOS_AROMOS } from '@team27/data-main/seed';

const store = vi.hoisted(() => ({
  ids: [] as string[],
  definitions: new Map<string, unknown>(),
}));

vi.mock('@team27/data-main', () => ({
  listProjectIds: () => Promise.resolve(store.ids),
  loadProjectDefinition: (_prisma: unknown, id: string) =>
    Promise.resolve(store.definitions.get(id) ?? null),
}));

const { loadProjectCatalog } =
  await import('../../../src/modules/project/project.module.ts');

const prisma = {} as PrismaClient;

const stored = (...projects: ProjectDefinition[]) => {
  store.ids = projects.map((project) => project.id);
  store.definitions = new Map(projects.map((project) => [project.id, project]));
};

describe('loadProjectCatalog', () => {
  it('con un solo proyecto en la base, lo carga sin PROJECT_ID', async () => {
    stored(LOS_AROMOS);
    const catalog = await loadProjectCatalog(prisma, undefined);
    expect(catalog.id).toBe('los-aromos');
    expect(catalog.author.id).toBe('fernanda-lagos');
    expect(catalog.stakeholders).toHaveLength(7);
  });

  it('sin proyectos, pide sembrar la base', async () => {
    stored();
    await expect(loadProjectCatalog(prisma, undefined)).rejects.toThrow(
      /pnpm db:seed/,
    );
  });

  it('con varios proyectos, exige PROJECT_ID', async () => {
    stored(LOS_AROMOS, { ...LOS_AROMOS, id: 'otro' });
    await expect(loadProjectCatalog(prisma, undefined)).rejects.toThrow(
      /PROJECT_ID/,
    );
    expect((await loadProjectCatalog(prisma, 'otro')).id).toBe('otro');
  });

  it('un PROJECT_ID que no está en la base no arranca', async () => {
    stored(LOS_AROMOS);
    await expect(loadProjectCatalog(prisma, 'nada')).rejects.toThrow(
      /no tiene el proyecto nada/,
    );
  });

  it('un proyecto mal formado no arranca', async () => {
    stored({
      ...LOS_AROMOS,
      members: LOS_AROMOS.members.map((member) => ({
        ...member,
        channel: 'paloma',
      })),
    });
    await expect(loadProjectCatalog(prisma, undefined)).rejects.toThrow(
      /no es válido/,
    );
  });

  it('un autor que no está en el elenco no arranca', async () => {
    stored({ ...LOS_AROMOS, authorId: 'nadie' });
    await expect(loadProjectCatalog(prisma, undefined)).rejects.toThrow(
      /autor nadie/,
    );
  });
});
