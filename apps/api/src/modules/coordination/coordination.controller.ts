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
  Query,
} from '@nestjs/common';
import { MAX_CHANGES } from '@team27/context-capture';
import { MAX_NOTE_LENGTH, RESPONSE_KINDS } from '@team27/context-notification';
import { z } from 'zod';

import {
  PRESENTER_KEY_HEADER,
  SEAT_TOKEN_HEADER,
  SeatsService,
} from '../room/seats.service.ts';
import { CoordinationService } from './coordination.service.ts';
import { type ProposalFilter, QueryService } from './query.service.ts';

const uuid = z.uuid();

const castId = z.string().min(1).max(64);

const spaceId = z.string().min(1).max(64);

const subjectPart = z.string().min(1).max(64);

const section = z.enum([
  'estructura',
  'instalaciones',
  'fachada',
  'costos',
  'plazo',
]);

const baselineQuery = z.object({ section: section.optional() });

const proposalsQuery = z.object({
  status: z
    .enum(['open', 'disputed', 'merged', 'withdrawn', 'replaced', 'active'])
    .optional(),
});

const changesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_CHANGES).default(20),
});

const dropBody = z.object({ fixtureId: z.string().min(1).max(64) });

const responseBody = z.object({
  kind: z.enum(RESPONSE_KINDS),
  note: z.string().max(MAX_NOTE_LENGTH).nullish(),
});

const dismissBody = z
  .object({ note: z.string().max(MAX_NOTE_LENGTH).nullish() })
  .default({});

const acknowledgeBody = z.object({
  revisionId: uuid,
  note: z.string().trim().min(1).max(MAX_NOTE_LENGTH),
});

@Controller()
export class CoordinationController {
  private readonly coordination: CoordinationService;
  private readonly queries: QueryService;
  private readonly seats: SeatsService;

  constructor(
    @Inject(CoordinationService) coordination: CoordinationService,
    @Inject(QueryService) queries: QueryService,
    @Inject(SeatsService) seats: SeatsService,
  ) {
    this.coordination = coordination;
    this.queries = queries;
    this.seats = seats;
  }

  @Get('spaces')
  spaces() {
    return this.queries.spaces();
  }

  @Get('baseline')
  baseline(
    @Query({ schema: baselineQuery }) query: z.output<typeof baselineQuery>,
  ) {
    return this.queries.baselineView(query.section);
  }

  @Get('baseline/:subjectId/:attribute/provenance')
  provenance(
    @Param('subjectId', { schema: subjectPart }) subjectId: string,
    @Param('attribute', { schema: subjectPart }) attribute: string,
  ) {
    return this.queries.provenance(subjectId, attribute);
  }

  @Get('seats/:castId/tray')
  async tray(
    @Param('castId', { schema: castId }) id: string,
    @Headers(SEAT_TOKEN_HEADER) token: string | undefined,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
  ) {
    await this.seats.actorFor(id, { token, key });
    return this.queries.tray(id);
  }

  @Get('seats/:castId/inbox')
  async inbox(
    @Param('castId', { schema: castId }) id: string,
    @Headers(SEAT_TOKEN_HEADER) token: string | undefined,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
  ) {
    await this.seats.actorFor(id, { token, key });
    return this.queries.inbox(id);
  }

  @Post('spaces/:spaceId/drops')
  async drop(
    @Param('spaceId', { schema: spaceId }) space: string,
    @Body({ schema: dropBody }) body: z.output<typeof dropBody>,
    @Headers(SEAT_TOKEN_HEADER) token: string | undefined,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
    @Headers('x-action-id') actionId: string | undefined,
  ) {
    return this.coordination.drop({
      seat: await this.seats.actor({ token, key }),
      spaceId: space,
      fixtureId: body.fixtureId,
      actionId,
    });
  }

  @Get('proposals')
  proposals(
    @Query({ schema: proposalsQuery }) query: z.output<typeof proposalsQuery>,
  ) {
    const status: ProposalFilter | undefined = query.status;
    return this.queries.proposalList(status);
  }

  @Post('notifications/:id/response')
  async respond(
    @Param('id', { schema: uuid }) id: string,
    @Body({ schema: responseBody }) body: z.output<typeof responseBody>,
    @Headers(SEAT_TOKEN_HEADER) token: string | undefined,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
    @Headers('x-action-id') actionId: string | undefined,
  ) {
    return this.coordination.vote({
      seat: await this.seats.actor({ token, key }),
      notificationId: id,
      vote: body,
      actionId,
    });
  }

  @Post('proposals/:id/reopen')
  async reopen(
    @Param('id', { schema: uuid }) id: string,
    @Headers(SEAT_TOKEN_HEADER) token: string | undefined,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
  ) {
    return this.coordination.reopen({
      seat: await this.seats.actor({ token, key }),
      proposalId: id,
    });
  }

  @Post('proposals/:id/withdraw')
  async withdraw(
    @Param('id', { schema: uuid }) id: string,
    @Headers(SEAT_TOKEN_HEADER) token: string | undefined,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
  ) {
    return this.coordination.withdraw({
      seat: await this.seats.actor({ token, key }),
      proposalId: id,
    });
  }

  @Post('discrepancies/:id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(
    @Param('id', { schema: uuid }) id: string,
    @Body({ schema: dismissBody }) body: z.output<typeof dismissBody>,
    @Headers(SEAT_TOKEN_HEADER) token: string | undefined,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
  ): Promise<void> {
    await this.coordination.dismiss({
      seat: await this.seats.actor({ token, key }),
      discrepancyId: id,
      note: body.note,
    });
  }

  @Post('stale/acknowledge')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acknowledge(
    @Body({ schema: acknowledgeBody }) body: z.output<typeof acknowledgeBody>,
    @Headers(SEAT_TOKEN_HEADER) token: string | undefined,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
  ): Promise<void> {
    await this.coordination.acknowledge({
      seat: await this.seats.actor({ token, key }),
      revisionId: body.revisionId,
      note: body.note,
    });
  }

  @Get('changes')
  changes(
    @Query({ schema: changesQuery }) query: z.output<typeof changesQuery>,
  ) {
    return this.queries.changes(query.limit);
  }

  @Get('changes/:id')
  change(@Param('id', { schema: uuid }) id: string) {
    return this.queries.change(id);
  }
}
