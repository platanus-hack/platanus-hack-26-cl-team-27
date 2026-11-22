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
  UseGuards,
} from '@nestjs/common';
import { MAX_CHANGES } from '@team27/context-lake';
import { MAX_NOTE_LENGTH, RESPONSE_KINDS } from '@team27/context-notification';
import { z } from 'zod';

import { AccountGuard, CurrentAccount } from '../accounts/account.guard.ts';
import { type Account, AccountsService } from '../accounts/accounts.service.ts';
import type { ProjectCatalog } from '../project/project-catalog.ts';
import { ProjectCatalogs } from '../project/project.module.ts';
import { CoordinationService } from './coordination.service.ts';
import { EventsService } from './events.service.ts';
import { fail } from './http-errors.ts';
import {
  type OverlapFilter,
  type ProposalFilter,
  QueryService,
} from './query.service.ts';
import { type RevisionInput, revisionBody } from './revision-body.ts';

const uuid = z.uuid();

const projectId = z.string().min(1).max(64);

const subjectPart = z.string().min(1).max(64);

const section = z.string().min(1).max(64);

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

const eventsQuery = z.object({
  after: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
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

@Controller('projects/:projectId')
@UseGuards(AccountGuard)
export class CoordinationController {
  private readonly coordination: CoordinationService;
  private readonly queries: QueryService;
  private readonly events: EventsService;
  private readonly catalogs: ProjectCatalogs;
  private readonly accounts: AccountsService;

  constructor(
    @Inject(CoordinationService) coordination: CoordinationService,
    @Inject(QueryService) queries: QueryService,
    @Inject(EventsService) events: EventsService,
    @Inject(ProjectCatalogs) catalogs: ProjectCatalogs,
    @Inject(AccountsService) accounts: AccountsService,
  ) {
    this.coordination = coordination;
    this.queries = queries;
    this.events = events;
    this.catalogs = catalogs;
    this.accounts = accounts;
  }

  private async project(account: Account, id: string): Promise<ProjectCatalog> {
    await this.accounts.requireProject(account, id);
    return this.catalogs.load(id);
  }

  private async teamProject(
    account: Account,
    id: string,
  ): Promise<ProjectCatalog> {
    const project = await this.project(account, id);
    if (!project.castMember(account.id)) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_on_team',
        'No eres parte del equipo de este proyecto',
      );
    }
    return project;
  }

  @Get('spaces')
  async spaces(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
  ) {
    return this.queries.spaces(await this.project(account, id));
  }

  @Get('baseline')
  async baseline(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Query({ schema: baselineQuery }) query: z.output<typeof baselineQuery>,
  ) {
    return this.queries.baselineView(
      await this.project(account, id),
      query.section,
    );
  }

  @Get('baseline/:subjectId/:attribute/provenance')
  async provenance(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Param('subjectId', { schema: subjectPart }) subjectId: string,
    @Param('attribute', { schema: subjectPart }) attribute: string,
  ) {
    return this.queries.provenance(
      await this.project(account, id),
      subjectId,
      attribute,
    );
  }

  @Get('inbox')
  async inbox(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
  ) {
    return this.queries.inbox(await this.project(account, id), account.id);
  }

  @Get('events')
  async eventList(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Query({ schema: eventsQuery }) query: z.output<typeof eventsQuery>,
  ) {
    await this.accounts.requireProject(account, id);
    return this.events.list(id, query.after, query.limit);
  }

  @Post('revisions')
  async ingest(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Body({ schema: revisionBody }) body: RevisionInput,
    @Headers('x-action-id') actionId: string | undefined,
  ) {
    return this.coordination.ingest({
      project: await this.teamProject(account, id),
      actor: account.id,
      revision: body,
      actionId,
    });
  }

  @Get('proposals')
  async proposals(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Query({ schema: proposalsQuery }) query: z.output<typeof proposalsQuery>,
  ) {
    const status: ProposalFilter | undefined = query.status;
    return this.queries.proposalList(await this.project(account, id), status);
  }

  @Get('overlaps')
  async overlaps(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Query({ schema: overlapsQuery }) query: z.output<typeof overlapsQuery>,
  ) {
    const status: OverlapFilter | undefined = query.status;
    return this.queries.overlapList(await this.project(account, id), status);
  }

  @Get('areas')
  async areas(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
  ) {
    return this.queries.areas(await this.project(account, id));
  }

  @Post('overlaps/:id/vote')
  @HttpCode(HttpStatus.OK)
  async voteOverlap(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Param('id', { schema: uuid }) overlapId: string,
    @Body({ schema: overlapVoteBody }) body: z.output<typeof overlapVoteBody>,
    @Headers('x-action-id') actionId: string | undefined,
  ) {
    return this.coordination.voteOverlap({
      project: await this.teamProject(account, id),
      actor: account.id,
      overlapId,
      vote: body,
      actionId,
    });
  }

  @Post('notifications/:id/response')
  async respond(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Param('id', { schema: uuid }) notificationId: string,
    @Body({ schema: responseBody }) body: z.output<typeof responseBody>,
    @Headers('x-action-id') actionId: string | undefined,
  ) {
    return this.coordination.vote({
      project: await this.teamProject(account, id),
      actor: account.id,
      notificationId,
      vote: body,
      actionId,
    });
  }

  @Post('proposals/:id/reopen')
  async reopen(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Param('id', { schema: uuid }) proposalId: string,
  ) {
    return this.coordination.reopen({
      project: await this.teamProject(account, id),
      actor: account.id,
      proposalId,
    });
  }

  @Post('proposals/:id/withdraw')
  async withdraw(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Param('id', { schema: uuid }) proposalId: string,
  ) {
    return this.coordination.withdraw({
      project: await this.teamProject(account, id),
      actor: account.id,
      proposalId,
    });
  }

  @Post('discrepancies/:id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Param('id', { schema: uuid }) discrepancyId: string,
    @Body({ schema: dismissBody }) body: z.output<typeof dismissBody>,
  ): Promise<void> {
    await this.coordination.dismiss({
      project: await this.teamProject(account, id),
      actor: account.id,
      discrepancyId,
      note: body.note,
    });
  }

  @Post('stale/acknowledge')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acknowledge(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Body({ schema: acknowledgeBody }) body: z.output<typeof acknowledgeBody>,
  ): Promise<void> {
    await this.coordination.acknowledge({
      project: await this.teamProject(account, id),
      actor: account.id,
      revisionId: body.revisionId,
      note: body.note,
    });
  }

  @Get('changes')
  async changes(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Query({ schema: changesQuery }) query: z.output<typeof changesQuery>,
  ) {
    return this.queries.changes(await this.project(account, id), query.limit);
  }

  @Get('changes/:id')
  async change(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Param('id', { schema: uuid }) changeId: string,
  ) {
    return this.queries.change(await this.project(account, id), changeId);
  }

  @Get('changes/:id/suggestions')
  async suggestions(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Param('id', { schema: uuid }) changeId: string,
  ) {
    return this.queries.suggestions(await this.project(account, id), changeId);
  }

  @Get('changes/:id/conflicts')
  async conflicts(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Param('id', { schema: uuid }) changeId: string,
  ) {
    return this.queries.conflicts(await this.project(account, id), changeId);
  }

  @Get('changes/:id/notices')
  async notices(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Param('id', { schema: uuid }) changeId: string,
  ) {
    return this.queries.notices(await this.project(account, id), changeId);
  }
}
