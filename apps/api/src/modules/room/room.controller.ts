import {
  Body,
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
import {
  PRESENTER_KEY_HEADER,
  SEAT_TOKEN_HEADER,
  SeatsService,
} from './seats.service.ts';
import { SPEEDS, type Speed } from './state.ts';

const castId = z.string().min(1).max(64);

const sceneId = z.string().min(1).max(16);

const eventsQuery = z.object({
  after: z.coerce.number().int().min(0).optional(),
  epoch: z.coerce.number().int().min(0).optional(),
  seat: castId.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const autoplayBody = z
  .object({
    enabled: z.boolean().optional(),
    on: z.boolean().optional(),
    speed: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(1),
  })
  .refine((body) => body.enabled !== undefined || body.on !== undefined, {
    message: 'Falta indicar si el autoplay está encendido',
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
    @Headers(SEAT_TOKEN_HEADER) token: string | undefined,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
  ): Promise<void> {
    await this.seats.release(id, { token, key });
  }

  @Get('room/scenes')
  scenes(@Headers(PRESENTER_KEY_HEADER) key: string | undefined) {
    this.seats.requirePresenter(key);
    return this.room.scenes();
  }

  @Post('room/scenes/:id/play')
  @HttpCode(HttpStatus.NO_CONTENT)
  async play(
    @Param('id', { schema: sceneId }) id: string,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
  ): Promise<void> {
    this.seats.requirePresenter(key);
    await this.room.play(id);
  }

  @Post('room/autoplay')
  @HttpCode(HttpStatus.NO_CONTENT)
  async autoplay(
    @Body({ schema: autoplayBody }) body: z.output<typeof autoplayBody>,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
  ): Promise<void> {
    this.seats.requirePresenter(key);
    const speed: Speed = SPEEDS.includes(body.speed) ? body.speed : 1;
    await this.room.setAutoplay(body.enabled ?? body.on ?? false, speed);
  }

  @Post('room/reset')
  @HttpCode(HttpStatus.OK)
  reset(@Headers(PRESENTER_KEY_HEADER) key: string | undefined) {
    this.seats.requirePresenter(key);
    return this.room.reset();
  }
}
