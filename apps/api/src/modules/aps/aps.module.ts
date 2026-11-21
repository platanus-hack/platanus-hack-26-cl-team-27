import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/index.ts';
import { ApsAuth } from './aps-auth.ts';
import { ApsController } from './aps.controller.ts';
import { APS_AUTH, MODELS_CATALOG_READER } from './aps.tokens.ts';
import { readCatalog } from './models-catalog.ts';

@Module({
  controllers: [ApsController],
  providers: [
    {
      provide: APS_AUTH,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const clientId = config.get('APS_CLIENT_ID', { infer: true });
        const clientSecret = config.get('APS_CLIENT_SECRET', { infer: true });
        return clientId && clientSecret
          ? new ApsAuth({ clientId, clientSecret })
          : null;
      },
    },
    { provide: MODELS_CATALOG_READER, useValue: () => readCatalog() },
  ],
})
export class ApsModule {}
