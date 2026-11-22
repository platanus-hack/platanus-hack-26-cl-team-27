import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';

import { RoomService } from './room.service.ts';
import { SeatCredentials } from './credentials.ts';
import {
  type Credentials,
  PRESENTER_KEY_HEADER,
  SEAT_TOKEN_HEADER,
  SeatsService,
} from './seats.service.ts';

const castId = z.string().min(1).max(64);

const eventsQuery = z.object({
  after: z.coerce.number().int().min(0).optional(),
  epoch: z.coerce.number().int().min(0).optional(),
  seat: castId.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

@Controller()
export class RoomController {
  private readonly room: RoomService;
  private readonly seats: SeatsService;

  constructor(
    @Inject(RoomService) room: RoomService,
    @Inject(SeatsService) seats: SeatsService,
  ) {
    this.room = room;
    this.seats = seats;
  }

  @Get('room')
  snapshot() {
    return this.room.room();
  }

  @Get('events')
  events(
    @Query({ schema: eventsQuery }) query: z.output<typeof eventsQuery>,
    @Headers(SEAT_TOKEN_HEADER) token: string | undefined,
  ) {
    return this.room.events({
      after: query.after,
      epoch: query.epoch,
      limit: query.limit,
      token,
    });
  }

  @Post('seats/:castId/claim')
  claim(@Param('castId', { schema: castId }) id: string) {
    return this.room.claim(id);
  }

  @Delete('seats/:castId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async release(
    @Param('castId', { schema: castId }) id: string,
    @SeatCredentials() credentials: Credentials,
  ): Promise<void> {
    await this.seats.release(id, credentials);
  }

  @Post('room/reset')
  @HttpCode(HttpStatus.OK)
  reset(@Headers(PRESENTER_KEY_HEADER) key: string | undefined) {
    this.seats.requirePresenter(key);
    return this.room.reset();
  }
}
