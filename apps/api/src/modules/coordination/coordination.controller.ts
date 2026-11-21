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

import { SeatCredentials } from '../room/credentials.ts';
import {
  type Credentials,
  PRESENTER_KEY_HEADER,
  SeatsService,
} from '../room/seats.service.ts';
import { CoordinationService } from './coordination.service.ts';
import {
  type OverlapFilter,
  type ProposalFilter,
  QueryService,
} from './query.service.ts';
import {
  type RevisionInput,
  revisionBody,
  type SeedInput,
  seedBody,
} from './revision-body.ts';

const uuid = z.uuid();

const castId = z.string().min(1).max(64);

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

const overlapsQuery = z.object({
  status: z
    .enum(['abierto', 'descartado', 'confirmado', 'resuelto', 'activo'])
    .optional(),
});

const overlapVoteBody = z.object({
  kind: z.enum(['se_tocan', 'no_se_tocan']),
  note: z.string().max(MAX_NOTE_LENGTH).nullish(),
});

const changesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_CHANGES).default(20),
});

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

  @Get('seats/:castId/inbox')
  async inbox(
    @Param('castId', { schema: castId }) id: string,
    @SeatCredentials() credentials: Credentials,
  ) {
    await this.seats.actorFor(id, credentials);
    return this.queries.inbox(id);
  }

  @Post('revisions')
  async ingest(
    @Body({ schema: revisionBody }) body: RevisionInput,
    @SeatCredentials() credentials: Credentials,
    @Headers('x-action-id') actionId: string | undefined,
  ) {
    return this.coordination.ingest({
      seat: await this.seats.actor(credentials),
      revision: body,
      actionId,
    });
  }

  @Post('lake/seed')
  @HttpCode(HttpStatus.CREATED)
  seed(
    @Body({ schema: seedBody }) body: SeedInput,
    @Headers(PRESENTER_KEY_HEADER) key: string | undefined,
  ) {
    this.seats.requirePresenter(key);
    return this.coordination.seed(body);
  }

  @Get('proposals')
  proposals(
    @Query({ schema: proposalsQuery }) query: z.output<typeof proposalsQuery>,
  ) {
    const status: ProposalFilter | undefined = query.status;
    return this.queries.proposalList(status);
  }

  @Get('overlaps')
  overlaps(
    @Query({ schema: overlapsQuery }) query: z.output<typeof overlapsQuery>,
  ) {
    const status: OverlapFilter | undefined = query.status;
    return this.queries.overlapList(status);
  }

  @Get('areas')
  areas() {
    return this.queries.areas();
  }

  @Post('overlaps/:id/vote')
  @HttpCode(HttpStatus.OK)
  async voteOverlap(
    @Param('id', { schema: uuid }) id: string,
    @Body({ schema: overlapVoteBody }) body: z.output<typeof overlapVoteBody>,
    @SeatCredentials() credentials: Credentials,
    @Headers('x-action-id') actionId: string | undefined,
  ) {
    return this.coordination.voteOverlap({
      seat: await this.seats.actor(credentials),
      overlapId: id,
      vote: body,
      actionId,
    });
  }

  @Post('notifications/:id/response')
  async respond(
    @Param('id', { schema: uuid }) id: string,
    @Body({ schema: responseBody }) body: z.output<typeof responseBody>,
    @SeatCredentials() credentials: Credentials,
    @Headers('x-action-id') actionId: string | undefined,
  ) {
    return this.coordination.vote({
      seat: await this.seats.actor(credentials),
      notificationId: id,
      vote: body,
      actionId,
    });
  }

  @Post('proposals/:id/reopen')
  async reopen(
    @Param('id', { schema: uuid }) id: string,
    @SeatCredentials() credentials: Credentials,
  ) {
    return this.coordination.reopen({
      seat: await this.seats.actor(credentials),
      proposalId: id,
    });
  }

  @Post('proposals/:id/withdraw')
  async withdraw(
    @Param('id', { schema: uuid }) id: string,
    @SeatCredentials() credentials: Credentials,
  ) {
    return this.coordination.withdraw({
      seat: await this.seats.actor(credentials),
      proposalId: id,
    });
  }

  @Post('discrepancies/:id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(
    @Param('id', { schema: uuid }) id: string,
    @Body({ schema: dismissBody }) body: z.output<typeof dismissBody>,
    @SeatCredentials() credentials: Credentials,
  ): Promise<void> {
    await this.coordination.dismiss({
      seat: await this.seats.actor(credentials),
      discrepancyId: id,
      note: body.note,
    });
  }

  @Post('stale/acknowledge')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acknowledge(
    @Body({ schema: acknowledgeBody }) body: z.output<typeof acknowledgeBody>,
    @SeatCredentials() credentials: Credentials,
  ): Promise<void> {
    await this.coordination.acknowledge({
      seat: await this.seats.actor(credentials),
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
