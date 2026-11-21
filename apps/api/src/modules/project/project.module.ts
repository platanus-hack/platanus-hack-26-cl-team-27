import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  listProjectIds,
  loadProjectDefinition,
  type PrismaClient,
} from '@team27/data-main';

import type { Env } from '../../config/index.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { ProjectCatalog } from './project-catalog.ts';
import { projectSchema } from './project-schema.ts';

export const PROJECT_CATALOG = 'PROJECT_CATALOG';

const SEED_HINT = 'En local, siémbralo con «pnpm db:seed».';

const chooseProjectId = async (
  prisma: PrismaClient,
  configured: string | undefined,
): Promise<string> => {
  if (configured) return configured;
  const ids = await listProjectIds(prisma);
  const [only] = ids;
  if (ids.length === 1 && only) return only;
  if (ids.length === 0) {
    throw new Error(`La base no tiene ningún proyecto. ${SEED_HINT}`);
  }
  throw new Error(
    `La base tiene ${ids.length} proyectos (${ids.join(', ')}): elige uno con PROJECT_ID.`,
  );
};

export const loadProjectCatalog = async (
  prisma: PrismaClient,
  configured: string | undefined,
): Promise<ProjectCatalog> => {
  const id = await chooseProjectId(prisma, configured);
  const definition = await loadProjectDefinition(prisma, id);
  if (!definition) {
    throw new Error(`La base no tiene el proyecto ${id}. ${SEED_HINT}`);
  }
  const parsed = projectSchema.safeParse(definition);
  if (!parsed.success) {
    throw new Error(
      `El proyecto ${id} de la base no es válido: ${parsed.error.message}`,
    );
  }
  return new ProjectCatalog(parsed.data);
};

@Global()
@Module({
  providers: [
    {
      provide: PROJECT_CATALOG,
      inject: [PRISMA_CLIENT, ConfigService],
      useFactory: (prisma: PrismaClient, config: ConfigService<Env, true>) =>
        loadProjectCatalog(prisma, config.get('PROJECT_ID', { infer: true })),
    },
  ],
  exports: [PROJECT_CATALOG],
})
export class ProjectModule {}
