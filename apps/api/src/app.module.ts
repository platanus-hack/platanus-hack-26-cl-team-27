import { Module } from '@nestjs/common';

import { ConfigModule } from './config/index.ts';
import { AccountsModule } from './modules/accounts/accounts.module.ts';
import { ApsModule } from './modules/aps/aps.module.ts';
import { CoordinationModule } from './modules/coordination/coordination.module.ts';
import { DatabaseModule } from './modules/database/database.module.ts';
import { ProjectModule } from './modules/project/project.module.ts';
import { HealthModule } from './modules/health/health.module.ts';
import { ApsConnectionModule } from './modules/integrations/aps/aps-connection.module.ts';
import { IntegrationsModule } from './modules/integrations/integrations.module.ts';
import { NotificationDeliveryModule } from './modules/notification/notification.module.ts';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ProjectModule,
    HealthModule,
    CoordinationModule,
    ApsModule,
    AccountsModule,
    IntegrationsModule,
    ApsConnectionModule,
    NotificationDeliveryModule,
  ],
})
export class AppModule {}
