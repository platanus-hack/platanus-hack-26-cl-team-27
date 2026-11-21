import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtractClaims } from '@team27/context-inference';

import { provideUseCase } from '../../common/provide-use-case.ts';
import type { Env } from '../../config/index.ts';
import { chooseClaimReader } from './claim-reader.ts';

export const CLAIM_READER = 'CLAIM_READER';

@Module({
  providers: [
    {
      provide: CLAIM_READER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        chooseClaimReader(config.get('ANTHROPIC_API_KEY', { infer: true }))
          .reader,
    },
    provideUseCase(ExtractClaims, [CLAIM_READER]),
  ],
  exports: [ExtractClaims],
})
export class InferenceModule {}
