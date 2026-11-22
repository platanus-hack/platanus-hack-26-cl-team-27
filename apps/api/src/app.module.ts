import { Module } from '@nestjs/common';

import { ConfigModule } from './config/index.ts';
import { AccountsModule } from './modules/accounts/accounts.module.ts';
import { ApsModule } from './modules/aps/aps.module.ts';
import { CoordinationModule } from './modules/coordination/coordination.module.ts';
import { DatabaseModule } from './modules/database/database.module.ts';
import { ProjectModule } from './modules/project/project.module.ts';
import { RoomModule } from './modules/room/room.module.ts';
import { FlowModule } from './modules/flow/flow.module.ts';
import { HealthModule } from './modules/health/health.module.ts';
import { IntegrationsModule } from './modules/integrations/integrations.module.ts';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ProjectModule,
    HealthModule,
    CoordinationModule,
    RoomModule,
    ApsModule,
    FlowModule,
    AccountsModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
