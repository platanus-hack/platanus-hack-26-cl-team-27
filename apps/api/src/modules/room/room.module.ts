import { Module } from '@nestjs/common';

import { CoordinationModule } from '../coordination/coordination.module.ts';
import { RoomController } from './room.controller.ts';
import { RoomService } from './room.service.ts';
import { RoomStoreModule } from './store.module.ts';

@Module({
  imports: [CoordinationModule, RoomStoreModule],
  providers: [RoomService],
  controllers: [RoomController],
})
export class RoomModule {}
