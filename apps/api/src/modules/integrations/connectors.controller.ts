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
  Redirect,
} from '@nestjs/common';
import { z } from 'zod';

import { PRESENTER_KEY_HEADER, SeatsService } from '../room/seats.service.ts';
import { IntegrationsService } from './integrations.service.ts';
import { guard } from './views.ts';

const uuid = z.uuid();

const linkBody = z.object({
  documentId: z.string().min(1).max(64),
  url: z.string().trim().min(1).max(500),
});

const callbackQuery = z.object({
  code: z.string().max(2000).optional(),
  state: z.string().max(200).optional(),
  error: z.string().max(200).optional(),
});

@Controller('integrations')
export class ConnectorsController {
  private readonly integrations: IntegrationsService;
  private readonly seats: SeatsService;

  constructor(
    @Inject(IntegrationsService) integrations: IntegrationsService,
    @Inject(SeatsService) seats: SeatsService,
  ) {
    this.integrations = integrations;
    this.seats = seats;
  }

  @Get()
  overview(@Headers(PRESENTER_KEY_HEADER) key: string | undefined) {
    this.seats.requirePresenter(key);
    return guard(() => this.integrations.overview());
  }

  @Post('google/authorize')
  @HttpCode(HttpStatus.OK)
  authorize(@Headers(PRESENTER_KEY_HEADER) key: string | undefined) {
    this.seats.requirePresenter(key);
    return guard(async () => this.integrations.authorizationUrl());
  }

  @Get('google/callback')
  @Redirect()
  async callback(
    @Query({ schema: callbackQuery }) query: z.output<typeof callbackQuery>,
  ) {
    return { url: await this.integrations.completeAuthorization(query) };
  }

  @Delete('google')
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@Headers(PRESENTER_KEY_HEADER) key: string | undefined) {
    this.seats.requirePresenter(key);
    return guard(() => this.integrations.disconnect());
  }

  @Post('sources')
  link(
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
    @Body({ schema: linkBody }) body: z.output<typeof linkBody>,
  ) {
    this.seats.requirePresenter(key);
    return guard(() => this.integrations.link(body));
  }

  @Post('sources/:id/sync')
  @HttpCode(HttpStatus.OK)
  sync(
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
    @Param('id', { schema: uuid }) id: string,
  ) {
    this.seats.requirePresenter(key);
    return guard(() => this.integrations.sync(id));
  }

  @Delete('sources/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlink(
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
    @Param('id', { schema: uuid }) id: string,
  ) {
    this.seats.requirePresenter(key);
    return guard(() => this.integrations.unlink(id));
  }
}
