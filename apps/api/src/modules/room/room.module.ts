import { Module } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { CoordinationModule } from '../coordination/coordination.module.ts';
import { ChangeSignal } from '../database/change-signal.ts';
import { PRISMA_CLIENT } from '../database/prisma-token.ts';
import { EventsHub } from './events-hub.ts';
import { PrismaEventsStore } from './events-store.ts';
import { RoomController } from './room.controller.ts';
import { RoomService } from './room.service.ts';
import { RoomStoreModule } from './store.module.ts';

@Module({
  imports: [CoordinationModule, RoomStoreModule],
  providers: [
    {
      provide: EventsHub,
      inject: [PRISMA_CLIENT, ChangeSignal],
      useFactory: (prisma: PrismaClient, signal: ChangeSignal) =>
        new EventsHub(new PrismaEventsStore(prisma), signal),
    },
    RoomService,
  ],
  controllers: [RoomController],
})
export class RoomModule {}
