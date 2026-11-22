import { HttpException } from '@nestjs/common';
import type { PrismaClient, ProjectDefinition } from '@team27/data-main';

import { LOS_AROMOS } from '../../fixtures/los-aromos.ts';

const store = vi.hoisted(() => ({
  definitions: new Map<string, unknown>(),
}));

vi.mock('@team27/data-main', () => ({
  loadProjectDefinition: (_prisma: unknown, id: string) =>
    Promise.resolve(store.definitions.get(id) ?? null),
}));

const { loadProjectCatalog } =
  await import('../../../src/modules/project/project.module.ts');

const prisma = {} as PrismaClient;

const stored = (...projects: ProjectDefinition[]) => {
  store.definitions = new Map(projects.map((project) => [project.id, project]));
};

describe('loadProjectCatalog', () => {
  it('carga el proyecto que se pide', async () => {
    stored(LOS_AROMOS, { ...LOS_AROMOS, id: 'otro' });
    const catalog = await loadProjectCatalog(prisma, 'otro');
    expect(catalog.id).toBe('otro');
    expect(catalog.author.id).toBe('fernanda-lagos');
    expect(catalog.stakeholders).toHaveLength(7);
  });

  it('un proyecto que no está en la base responde 404', async () => {
    stored(LOS_AROMOS);
    const error: unknown = await loadProjectCatalog(prisma, 'nada').catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(404);
  });

  it('un proyecto mal formado falla y dice por qué', async () => {
    stored({
      ...LOS_AROMOS,
      members: LOS_AROMOS.members.map((member) => ({
        ...member,
        channel: 'paloma',
      })),
    });
    await expect(loadProjectCatalog(prisma, 'los-aromos')).rejects.toThrow(
      /no es válido/,
    );
  });

  it('un autor que no está en el elenco falla', async () => {
    stored({ ...LOS_AROMOS, authorId: 'nadie' });
    await expect(loadProjectCatalog(prisma, 'los-aromos')).rejects.toThrow(
      /autor nadie/,
    );
  });

  it('un proyecto recién creado, solo con quien lo creó, también carga', async () => {
    stored({
      ...LOS_AROMOS,
      id: 'nuevo',
      members: [
        {
          id: 'creador',
          name: 'Ana Soto',
          role: 'Creador del proyecto',
          channel: 'email',
          handle: 'ana.soto@cordillera.test',
        },
      ],
      authorId: 'creador',
      costOwnerId: 'creador',
      scheduleOwnerId: 'creador',
      modelDocumentId: null,
      spaces: [],
      documents: [],
      attributes: [],
      subjects: [],
      elements: [],
      budgetItems: [],
      tasks: [],
      dependencies: [],
      levels: [],
      longitudinalAxes: [],
      transversalAxes: [],
      systems: [],
    });
    const catalog = await loadProjectCatalog(prisma, 'nuevo');
    expect(catalog.author.id).toBe('creador');
    expect(catalog.stakeholders).toEqual([]);
    expect(catalog.documents).toEqual([]);
  });
});
