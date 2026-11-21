import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';

import {
  PRESENTER_KEY_HEADER,
  SEAT_TOKEN_HEADER,
  SeatsService,
} from '../room/seats.service.ts';
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
    @Headers(SEAT_TOKEN_HEADER) token: string | undefined,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
  ) {
    return this.coordination.receiveMinute({
      seat: await this.seats.actor({ token, key }),
      minute,
    });
  }
}
