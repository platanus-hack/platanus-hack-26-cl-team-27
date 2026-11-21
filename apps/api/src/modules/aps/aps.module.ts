import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/index.ts';
import { ApsAuth } from './aps-auth.ts';
import { ApsController } from './aps.controller.ts';
import { APS_AUTH, MODELS_CATALOG } from './aps.tokens.ts';
import { createModelsCatalog } from './models-catalog.ts';

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
    {
      provide: MODELS_CATALOG,
      inject: [APS_AUTH, ConfigService],
      useFactory: (auth: ApsAuth | null, config: ConfigService<Env, true>) => {
        const bucketKey = config.get('APS_BUCKET_KEY', { infer: true });
        return auth && bucketKey ? createModelsCatalog(auth, bucketKey) : null;
      },
    },
  ],
})
export class ApsModule {}
