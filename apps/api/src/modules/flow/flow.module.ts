import { Module } from '@nestjs/common';

import { RoomStoreModule } from '../room/store.module.ts';
import { FlowController } from './flow.controller.ts';
import { FlowService } from './flow.service.ts';

@Module({
  imports: [RoomStoreModule],
  providers: [FlowService],
  controllers: [FlowController],
})
export class FlowModule {}
