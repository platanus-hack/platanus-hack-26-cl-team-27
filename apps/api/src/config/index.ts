import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { envSchema } from './env.ts';

export const ConfigModule = NestConfigModule.forRoot({
  isGlobal: true,
  ignoreEnvFile: true,
  validationSchema: envSchema,
});

export type { Env } from './env.ts';
