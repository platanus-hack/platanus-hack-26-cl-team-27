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
import { LOS_AROMOS } from '../../scenario/los-aromos.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { chooseClaimReader } from './claim-reader.ts';

export const PROJECT_GRAPH = 'PROJECT_GRAPH';
export const IMPACT_REPOSITORY = 'IMPACT_REPOSITORY';
export const CLAIM_READER = 'CLAIM_READER';

export const buildImpact = (db: PrismaClient) => {
  const graph = new InMemoryProjectGraph(LOS_AROMOS.graph);
  const impacts = new PrismaImpactRepository(db);
  return {
    analyzeChange: new AnalyzeChange(graph, impacts),
    getImpacts: new GetImpacts(impacts),
  };
};

@Module({
  providers: [
    {
      provide: PROJECT_GRAPH,
      useFactory: () => new InMemoryProjectGraph(LOS_AROMOS.graph),
    },
    {
      provide: IMPACT_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) => new PrismaImpactRepository(prisma),
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
