import { Module } from '@nestjs/common';

import { AccountsModule } from '../accounts/accounts.module.ts';
import { ImpactModule } from '../impact/impact.module.ts';
import { ChunkReader } from './chunk-reader.ts';
import { CoordinationController } from './coordination.controller.ts';
import { CoordinationService } from './coordination.service.ts';
import { EventsService } from './events.service.ts';
import { QueryService } from './query.service.ts';

@Module({
  imports: [AccountsModule, ImpactModule],
  providers: [ChunkReader, CoordinationService, EventsService, QueryService],
  controllers: [CoordinationController],
})
export class CoordinationModule {}
