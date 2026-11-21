import { Body, Controller, Inject, Post } from '@nestjs/common';

import { SeatCredentials } from '../room/credentials.ts';
import { type Credentials, SeatsService } from '../room/seats.service.ts';
import { CoordinationService } from './coordination.service.ts';
import { revitMinuteBody, type RevitMinute } from './revit-minute.ts';

@Controller('integrations')
export class IntegrationsController {
  private readonly coordination: CoordinationService;
  private readonly seats: SeatsService;

  constructor(
    @Inject(CoordinationService) coordination: CoordinationService,
    @Inject(SeatsService) seats: SeatsService,
  ) {
    this.coordination = coordination;
    this.seats = seats;
  }

  @Post('revit/minutes')
  async revitMinute(
    @Body({ schema: revitMinuteBody }) minute: RevitMinute,
    @SeatCredentials() credentials: Credentials,
  ) {
    return this.coordination.receiveMinute({
      seat: await this.seats.actor(credentials),
      minute,
    });
  }
}
