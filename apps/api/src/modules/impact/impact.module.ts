import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnalyzeChange,
  ExtractClaims,
  GetImpacts,
} from '@team27/context-impact';
import {
  InMemoryProjectGraph,
  PrismaImpactRepository,
} from '@team27/context-impact/adapters';
import type { PrismaClient } from '@team27/data-main';

import { provideUseCase } from '../../common/provide-use-case.ts';
import type { Env } from '../../config/index.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import type { ProjectCatalog } from '../project/project-catalog.ts';
import { PROJECT_CATALOG } from '../project/project.module.ts';
import { chooseClaimReader } from './claim-reader.ts';

export const PROJECT_GRAPH = 'PROJECT_GRAPH';
export const IMPACT_REPOSITORY = 'IMPACT_REPOSITORY';
export const CLAIM_READER = 'CLAIM_READER';

export const buildImpact = (db: PrismaClient, project: ProjectCatalog) => {
  const graph = new InMemoryProjectGraph(project.graph);
  const impacts = new PrismaImpactRepository(db, project.id);
  return {
    analyzeChange: new AnalyzeChange(graph, impacts),
    getImpacts: new GetImpacts(impacts),
  };
};

@Module({
  providers: [
    {
      provide: PROJECT_GRAPH,
      inject: [PROJECT_CATALOG],
      useFactory: (project: ProjectCatalog) =>
        new InMemoryProjectGraph(project.graph),
    },
    {
      provide: IMPACT_REPOSITORY,
      inject: [PRISMA_CLIENT, PROJECT_CATALOG],
      useFactory: (prisma: PrismaClient, project: ProjectCatalog) =>
        new PrismaImpactRepository(prisma, project.id),
    },
    {
      provide: CLAIM_READER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        chooseClaimReader(config.get('ANTHROPIC_API_KEY', { infer: true }))
          .reader,
    },
    provideUseCase(AnalyzeChange, [PROJECT_GRAPH, IMPACT_REPOSITORY]),
    provideUseCase(GetImpacts, [IMPACT_REPOSITORY]),
    provideUseCase(ExtractClaims, [CLAIM_READER]),
  ],
  exports: [AnalyzeChange, GetImpacts, ExtractClaims],
})
export class ImpactModule {}
