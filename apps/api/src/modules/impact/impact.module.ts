import { Module } from '@nestjs/common';
import { AnalyzeChange, GetImpacts } from '@team27/context-impact';
import {
  InMemoryProjectGraph,
  PrismaImpactRepository,
} from '@team27/context-impact/adapters';
import type { PrismaClient } from '@team27/data-main';

import { provideUseCase } from '../../common/provide-use-case.ts';
import { LOS_AROMOS } from '../../scenario/los-aromos.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';

export const PROJECT_GRAPH = 'PROJECT_GRAPH';
export const IMPACT_REPOSITORY = 'IMPACT_REPOSITORY';

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
    provideUseCase(AnalyzeChange, [PROJECT_GRAPH, IMPACT_REPOSITORY]),
    provideUseCase(GetImpacts, [IMPACT_REPOSITORY]),
  ],
  exports: [AnalyzeChange, GetImpacts],
})
export class ImpactModule {}
