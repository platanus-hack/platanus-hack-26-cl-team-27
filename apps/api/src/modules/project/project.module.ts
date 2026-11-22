import { Global, HttpStatus, Inject, Injectable, Module } from '@nestjs/common';
import { loadProjectDefinition, type PrismaClient } from '@team27/data-main';

import { fail } from '../coordination/http-errors.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { ProjectCatalog } from './project-catalog.ts';
import { projectSchema } from './project-schema.ts';

export const loadProjectCatalog = async (
  prisma: PrismaClient,
  id: string,
): Promise<ProjectCatalog> => {
  const definition = await loadProjectDefinition(prisma, id);
  if (!definition) {
    throw fail(
      HttpStatus.NOT_FOUND,
      'not_found',
      'No encontramos ese proyecto en tus organizaciones',
    );
  }
  const parsed = projectSchema.safeParse(definition);
  if (!parsed.success) {
    throw new Error(
      `El proyecto ${id} de la base no es válido: ${parsed.error.message}`,
    );
  }
  return new ProjectCatalog(parsed.data);
};

@Injectable()
export class ProjectCatalogs {
  private readonly prisma: PrismaClient;

  constructor(@Inject(PRISMA_CLIENT) prisma: PrismaClient) {
    this.prisma = prisma;
  }

  load(id: string): Promise<ProjectCatalog> {
    return loadProjectCatalog(this.prisma, id);
  }
}

@Global()
@Module({
  providers: [ProjectCatalogs],
  exports: [ProjectCatalogs],
})
export class ProjectModule {}
