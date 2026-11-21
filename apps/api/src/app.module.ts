import { Module } from '@nestjs/common';

import { ConfigModule } from './config/index.ts';
import { CoordinationModule } from './modules/coordination/coordination.module.ts';
import { DatabaseModule } from './modules/database/database.module.ts';
import { HealthModule } from './modules/health/health.module.ts';

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, CoordinationModule],
})
export class AppModule {}
