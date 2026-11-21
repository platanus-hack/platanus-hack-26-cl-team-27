import { Module } from '@nestjs/common';

import { ConfigModule } from './config/index.ts';
import { CoordinationModule } from './modules/coordination/coordination.module.ts';
import { DatabaseModule } from './modules/database/database.module.ts';
import { RoomModule } from './modules/room/room.module.ts';
import { HealthModule } from './modules/health/health.module.ts';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    CoordinationModule,
    RoomModule,
  ],
})
export class AppModule {}
