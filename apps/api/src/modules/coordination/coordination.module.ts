import { Module } from '@nestjs/common';

import { CaptureModule } from '../capture/capture.module.ts';
import { ImpactModule } from '../impact/impact.module.ts';
import { NotificationModule } from '../notification/notification.module.ts';
import { CoordinationController } from './coordination.controller.ts';
import { CoordinationService } from './coordination.service.ts';

@Module({
  imports: [CaptureModule, ImpactModule, NotificationModule],
  providers: [CoordinationService],
  controllers: [CoordinationController],
})
export class CoordinationModule {}
