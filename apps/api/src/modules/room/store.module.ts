import { Module } from '@nestjs/common';

import { SeatsService } from './seats.service.ts';

@Module({ providers: [SeatsService], exports: [SeatsService] })
export class RoomStoreModule {}
