import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { z } from 'zod';

import { BASE_LABEL, FIX_LABEL_PREFIX } from '../../scenario/caso-p12.ts';

import { SeatCredentials } from '../room/credentials.ts';
import {
  type Credentials,
  PRESENTER_KEY_HEADER,
} from '../room/seats.service.ts';
import { FlowService } from './flow.service.ts';

const delta = z.object({
  dx: z.number().min(-5).max(5),
  dy: z.number().min(-5).max(5),
  dz: z.number().min(-5).max(5),
});

const minuteBody = z.object({
  minuteId: z
    .string()
    .min(1)
    .max(100)
    .refine(
      (id) => id !== BASE_LABEL && !id.startsWith(FIX_LABEL_PREFIX),
      'minuteId reservado',
    ),
  source: z.enum(['sala', 'revit']),
  model: z.object({
    title: z.string().min(1).max(200),
    discipline: z.string().min(1).max(100),
  }),
  changes: z
    .array(
      z.object({
        elementId: z.string().min(1).max(64),
        attribute: z.literal('location'),
        delta: delta.refine(
          (value) => value.dx !== 0 || value.dy !== 0 || value.dz !== 0,
          'El desplazamiento no puede ser cero',
        ),
        reason: z.string().min(1).max(500),
      }),
    )
    .length(1),
});

const proposalId = z.string().min(1).max(100);

const rejectBody = z.object({ reason: z.string().trim().min(1).max(500) });

const presenceBody = z.object({
  viewing: z.enum(['plano', 'propuesta']).nullable(),
});

export type MinuteBody = z.output<typeof minuteBody>;

@Controller('flow')
export class FlowController {
  private readonly flow: FlowService;

  constructor(@Inject(FlowService) flow: FlowService) {
    this.flow = flow;
  }

  @Get()
  state() {
    return this.flow.state();
  }

  @Get('history')
  history() {
    return this.flow.history();
  }

  @Post('minutes')
  minute(
    @Body({ schema: minuteBody }) body: MinuteBody,
    @SeatCredentials() credentials: Credentials,
  ) {
    return this.flow.minute(credentials, body);
  }

  @Post('proposals/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @Param('id', { schema: proposalId }) id: string,
    @SeatCredentials() credentials: Credentials,
  ) {
    return this.flow.accept(credentials, id);
  }

  @Post('proposals/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id', { schema: proposalId }) id: string,
    @Body({ schema: rejectBody }) body: z.output<typeof rejectBody>,
    @SeatCredentials() credentials: Credentials,
  ) {
    return this.flow.reject(credentials, id, body.reason);
  }

  @Post('presence')
  @HttpCode(HttpStatus.OK)
  presence(
    @Body({ schema: presenceBody }) body: z.output<typeof presenceBody>,
    @SeatCredentials() credentials: Credentials,
  ) {
    return this.flow.presence(credentials, body.viewing);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset(@Headers(PRESENTER_KEY_HEADER) key: string | undefined) {
    return this.flow.reset(key);
  }
}
