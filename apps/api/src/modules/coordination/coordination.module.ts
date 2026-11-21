import { Module } from '@nestjs/common';

import { CaptureModule } from '../capture/capture.module.ts';
import { ImpactModule } from '../impact/impact.module.ts';
import { LakeModule } from '../lake/lake.module.ts';
import { RoomStoreModule } from '../room/store.module.ts';
import { NotificationModule } from '../notification/notification.module.ts';
import { CoordinationController } from './coordination.controller.ts';
import { CoordinationService } from './coordination.service.ts';
import { IntegrationsController } from './integrations.controller.ts';
import { QueryService } from './query.service.ts';

@Module({
  imports: [
    CaptureModule,
    ImpactModule,
    LakeModule,
    NotificationModule,
    RoomStoreModule,
  ],
  exports: [CoordinationService, QueryService],
  providers: [CoordinationService, QueryService],
  controllers: [CoordinationController, IntegrationsController],
})
export class CoordinationModule {}
