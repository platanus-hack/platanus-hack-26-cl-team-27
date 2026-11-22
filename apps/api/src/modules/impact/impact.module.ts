import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnalyzeChange,
  ExtractClaims,
  GetImpacts,
  SuggestAffected,
} from '@team27/context-impact';
import {
  InMemoryProjectGraph,
  PrismaImpactRepository,
} from '@team27/context-impact/adapters';
import type { PrismaClient } from '@team27/data-main';

import { provideUseCase } from '../../common/provide-use-case.ts';
import type { Env } from '../../config/index.ts';
import type { ProjectCatalog } from '../project/project-catalog.ts';
import { chooseAffectedEstimator } from './affected-estimator.ts';
import { chooseClaimReader } from './claim-reader.ts';

export const CLAIM_READER = 'CLAIM_READER';

export const AFFECTED_ESTIMATOR = 'AFFECTED_ESTIMATOR';

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
      provide: CLAIM_READER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        chooseClaimReader(config.get('ANTHROPIC_API_KEY', { infer: true }), {
          apiKey: config.get('GEMINI_API_KEY', { infer: true }),
          model: config.get('GEMINI_MODEL', { infer: true }),
        }).reader,
    },
    {
      provide: AFFECTED_ESTIMATOR,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        chooseAffectedEstimator(
          config.get('ANTHROPIC_API_KEY', { infer: true }),
          {
            apiKey: config.get('GEMINI_API_KEY', { infer: true }),
            model: config.get('GEMINI_MODEL', { infer: true }),
          },
        ).estimator,
    },
    provideUseCase(ExtractClaims, [CLAIM_READER]),
    provideUseCase(SuggestAffected, [AFFECTED_ESTIMATOR]),
  ],
  exports: [ExtractClaims, SuggestAffected],
})
export class ImpactModule {}
