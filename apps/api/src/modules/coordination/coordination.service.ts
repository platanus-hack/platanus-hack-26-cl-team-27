import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import {
  findFixture,
  fixtureRevision,
  type Fixture,
  seededRevisions,
} from '../../scenario/documents.ts';
import { LOS_AROMOS } from '../../scenario/los-aromos.ts';
import { UnitOfWork } from '../database/unit-of-work.ts';
import { buildCapture } from '../capture/capture.module.ts';
import { buildImpact } from '../impact/impact.module.ts';
import { buildLake } from '../lake/lake.module.ts';
import { buildNotification } from '../notification/notification.module.ts';
import type {
  Decision,
  IngestedRevision,
  ProposalDraft,
} from '@team27/context-lake';
import { ActionLog } from './action-log.ts';
import { elementsFromBaseline } from './elements-from-baseline.ts';
import { fail } from './http-errors.ts';
import { castName, documentDef } from './lookup.ts';
import { QueryService } from './query.service.ts';
import { requireSeat } from './seat.ts';
import {
  proposalTitle,
  staleRefs,
  voteProposal,
  projectVersion,
} from './views.ts';

type Db = PrismaClient;

export interface VoteInput {
  readonly kind: 'reviewed' | 'issue';
  readonly note?: string | null | undefined;
}

export interface OpenedForDrop {
  readonly id: string;
  readonly changeId: string | null;
  readonly title: string;
  readonly costDelta: number;
  readonly delayDays: number;
  readonly reviewers: readonly string[];
  readonly filtered: readonly { stakeholderId: string; reason: string }[];
}

const OUTCOME = {
  same: 'same',
  corroborates: 'corroborates',
  change: 'change',
  discrepancy: 'discrepancy',
  unknown: 'new',
  uses_current: 'same',
  uses_proposed: 'corroborates',
  stale: 'stale',
} as const;

const lockProposal = async (db: Db, id: string): Promise<void> => {
  await db.$queryRaw`SELECT id FROM proposals WHERE id = ${id}::uuid FOR UPDATE`;
};

@Injectable()
export class CoordinationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CoordinationService.name);
  private readonly uow: UnitOfWork;
  private readonly queries: QueryService;
  private readonly actions = new ActionLog();

  constructor(
    @Inject(UnitOfWork) uow: UnitOfWork,
    @Inject(QueryService) queries: QueryService,
  ) {
    this.uow = uow;
    this.queries = queries;
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      if (await this.queries.isEmpty()) await this.reset();
    } catch (error) {
      this.logger.error(
        'No se pudo sembrar el lago de la muestra',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async reset(): Promise<void> {
    await this.uow.run(async (db) => {
      await db.notification.deleteMany();
      await db.impact.deleteMany();
      await db.change.deleteMany();
      await buildLake(db).seedLake.execute({ revisions: seededRevisions() });
    });
    this.actions.clear();
  }

  drop(input: {
    seat: string | undefined;
    spaceId: string;
    fixtureId: string;
    actionId: string | undefined;
  }) {
    const seat = requireSeat(input.seat);
    const fixture = findFixture(input.fixtureId);
    if (!fixture || fixture.spaceId !== input.spaceId) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'fixture_not_found',
        'Ese documento no está en ese espacio',
      );
    }
    if (fixture.seat !== seat) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_your_fixture',
        'Ese documento no es de tu asiento',
      );
    }
    return this.actions.once(input.actionId, `drop:${seat}:${fixture.id}`, () =>
      this.performDrop(fixture),
    );
  }

  private async performDrop(fixture: Fixture) {
    const { ingested, proposals } = await this.uow.run(async (db) => {
      const lake = buildLake(db);
      const existing = await lake.ports.revisions.findByKey(
        fixture.documentId,
        fixture.label,
      );
      if (existing) {
        throw fail(
          HttpStatus.CONFLICT,
          'already_ingested',
          'Ese documento ya está en el repositorio',
        );
      }
      for (const requirement of fixture.requires) {
        const required = await lake.ports.revisions.findByKey(
          requirement.documentId,
          requirement.label,
        );
        if (!required) {
          throw fail(
            HttpStatus.CONFLICT,
            'blocked',
            `Antes hay que soltar ${documentDef(requirement.documentId)?.name ?? requirement.documentId} ${requirement.label}`,
          );
        }
      }
      const result = await lake.ingestRevision.execute(
        fixtureRevision(fixture),
      );
      const opened: OpenedForDrop[] = [];
      for (const draft of result.drafts) {
        opened.push(await this.openProposal(db, draft));
      }
      return { ingested: result, proposals: opened };
    });
    return this.dropResponse(ingested, proposals);
  }

  private async openProposal(
    db: Db,
    draft: ProposalDraft,
  ): Promise<OpenedForDrop> {
    const lake = buildLake(db);
    const capture = buildCapture(db);
    const impact = buildImpact(db);
    const notification = buildNotification(db);

    const baseline = await lake.ports.baseline.list();
    const base = elementsFromBaseline(LOS_AROMOS.model, baseline).filter(
      (element) => element.id === draft.subject,
    );
    const next = elementsFromBaseline(LOS_AROMOS.model, baseline, {
      [draft.subject]: draft.after,
    }).filter((element) => element.id === draft.subject);
    const [change] = await capture.detectChanges.execute({
      sourceId: draft.sourceRevisionId,
      base,
      next,
    });

    let reviewerIds: string[] = [];
    let filtered: { id: string; reason: string }[] = [];
    let costDelta = 0;
    let delayDays = 0;
    if (change) {
      const analysis = await impact.analyzeChange.execute({
        id: change.id,
        elementId: change.element.id,
        elementName: change.element.name,
        category: change.element.category,
        changedKeys: change.diffs.map((diff) => diff.key),
        before: change.before,
        after: change.after,
      });
      const notified = await notification.notifyStakeholders.execute({
        changeId: change.id,
        title: `${change.element.name} · ${change.summary}`,
        findings: analysis.findings,
      });
      const notifiedIds = new Set(notified.map((item) => item.stakeholderId));
      reviewerIds = [
        ...new Set(analysis.findings.map((finding) => finding.stakeholderId)),
      ].filter((id) => notifiedIds.has(id));
      filtered = analysis.filtered.map((item) => ({
        id: item.stakeholderId,
        reason: item.reason,
      }));
      costDelta = analysis.costDelta;
      delayDays = analysis.delayDays;
    }

    const { proposal } = await lake.openProposal.execute({
      draft,
      changeId: change?.id ?? null,
      reviewerIds,
      filtered,
    });
    return {
      id: proposal.id,
      changeId: change?.id ?? null,
      title: proposalTitle(proposal),
      costDelta,
      delayDays,
      reviewers: reviewerIds,
      filtered: filtered.map((item) => ({
        stakeholderId: item.id,
        reason: item.reason,
      })),
    };
  }

  private async dropResponse(
    ingested: IngestedRevision,
    proposals: readonly OpenedForDrop[],
  ) {
    const snapshot = await this.queries.snapshot();
    return {
      revisionId: ingested.revision.id,
      claims: ingested.outcomes.map((outcome) => ({
        subjectId: outcome.claim.subject,
        attribute: outcome.claim.attribute,
        value: outcome.claim.value,
        outcome: OUTCOME[outcome.kind],
      })),
      proposals,
      discrepancies: ingested.openedDiscrepancies.map((discrepancy) => ({
        id: discrepancy.id,
        ownerId: discrepancy.ownerId,
      })),
      backed: ingested.backedDiscrepancies.map((discrepancy) => discrepancy.id),
      stale: staleRefs(snapshot.consensus.stale),
    };
  }

  vote(input: {
    seat: string | undefined;
    notificationId: string;
    vote: VoteInput;
    actionId: string | undefined;
  }) {
    const seat = requireSeat(input.seat);
    return this.actions.once(
      input.actionId,
      `vote:${seat}:${input.notificationId}`,
      () => this.performVote(seat, input.notificationId, input.vote),
    );
  }

  private async performVote(
    seat: string,
    notificationId: string,
    vote: VoteInput,
  ) {
    const { proposalId, notification } = await this.uow.run(async (db) => {
      const lake = buildLake(db);
      const notifications = buildNotification(db);
      const found = await notifications.getNotification.execute(notificationId);
      if (!found) {
        throw fail(
          HttpStatus.NOT_FOUND,
          'not_found',
          `No existe el aviso ${notificationId}`,
        );
      }
      if (found.stakeholderId !== seat) {
        throw fail(
          HttpStatus.FORBIDDEN,
          'not_your_notification',
          'Ese aviso no es de tu asiento',
        );
      }
      const candidates = (await lake.ports.proposals.list()).filter(
        (proposal) => proposal.changeId === found.changeId,
      );
      const target = candidates[candidates.length - 1];
      if (!target) {
        throw fail(
          HttpStatus.CONFLICT,
          'invalid_state',
          'El aviso no tiene una propuesta asociada',
        );
      }
      await lockProposal(db, target.id);
      const decision: Decision =
        vote.kind === 'reviewed' ? 'approve' : 'dispute';
      const recorded = await lake.recordReview.execute({
        proposalId: target.id,
        reviewerId: seat,
        decision,
        note: vote.note ?? null,
      });
      const updated = recorded.changed
        ? await notifications.respondToNotification.execute(notificationId, {
            kind: vote.kind,
            note: vote.note ?? null,
          })
        : found;
      return { proposalId: target.id, notification: updated ?? found };
    });
    const snapshot = await this.queries.snapshot();
    const proposal = snapshot.proposals.find((item) => item.id === proposalId);
    if (!proposal) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        'La propuesta ya no existe',
      );
    }
    return {
      notification,
      proposal: voteProposal(proposal),
      merged: proposal.status === 'merged',
      stale: staleRefs(snapshot.consensus.stale),
      projectVersion: projectVersion(snapshot),
    };
  }

  async reopen(input: { seat: string | undefined; proposalId: string }) {
    const seat = requireSeat(input.seat);
    await this.uow.run(async (db) => {
      const lake = buildLake(db);
      const notifications = buildNotification(db);
      await this.authorOf(db, input.proposalId, seat);
      await lockProposal(db, input.proposalId);
      const { proposal, reopenedReviewerIds } =
        await lake.reopenProposal.execute({
          proposalId: input.proposalId,
          actorId: seat,
        });
      if (proposal.changeId === null) return;
      for (const reviewerId of reopenedReviewerIds) {
        const [notification] = await notifications.listNotifications.execute({
          changeIds: [proposal.changeId],
          stakeholderId: reviewerId,
        });
        if (notification) {
          await notifications.reopenResponse.execute(notification.id);
        }
      }
    });
    return this.queries.proposal(input.proposalId);
  }

  async withdraw(input: { seat: string | undefined; proposalId: string }) {
    const seat = requireSeat(input.seat);
    await this.uow.run(async (db) => {
      await this.authorOf(db, input.proposalId, seat);
      await lockProposal(db, input.proposalId);
      await buildLake(db).withdrawProposal.execute({
        proposalId: input.proposalId,
        actorId: seat,
      });
    });
    return this.queries.proposal(input.proposalId);
  }

  private async authorOf(
    db: Db,
    proposalId: string,
    seat: string,
  ): Promise<void> {
    const proposal = await buildLake(db).ports.proposals.findById(proposalId);
    if (!proposal) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe la propuesta ${proposalId}`,
      );
    }
    if (proposal.authorId !== seat) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_author',
        `Solo ${castName(proposal.authorId)} puede hacerlo`,
      );
    }
  }

  async dismiss(input: {
    seat: string | undefined;
    discrepancyId: string;
    note?: string | null | undefined;
  }): Promise<void> {
    const seat = requireSeat(input.seat);
    await this.uow.run(async (db) => {
      const lake = buildLake(db);
      const discrepancy = await lake.ports.discrepancies.findById(
        input.discrepancyId,
      );
      if (!discrepancy) {
        throw fail(
          HttpStatus.NOT_FOUND,
          'not_found',
          `No existe la discrepancia ${input.discrepancyId}`,
        );
      }
      if (discrepancy.ownerId !== seat) {
        throw fail(
          HttpStatus.FORBIDDEN,
          'not_owner',
          'Solo el dueño del valor descarta la discrepancia',
        );
      }
      await lake.dismissDiscrepancy.execute({
        discrepancyId: input.discrepancyId,
        actorId: seat,
        note: input.note ?? null,
      });
    });
  }

  async acknowledge(input: {
    seat: string | undefined;
    revisionId: string;
    note: string;
  }): Promise<void> {
    const seat = requireSeat(input.seat);
    await this.uow.run(async (db) => {
      const lake = buildLake(db);
      const revision = await lake.ports.revisions.findById(input.revisionId);
      if (!revision) {
        throw fail(
          HttpStatus.NOT_FOUND,
          'not_found',
          `No existe la revisión ${input.revisionId}`,
        );
      }
      if (revision.authorId !== seat) {
        throw fail(
          HttpStatus.FORBIDDEN,
          'not_owner',
          'Solo el dueño del documento confirma sin cambio',
        );
      }
      await lake.acknowledgeStale.execute({
        documentId: revision.documentId,
        ownerId: seat,
        note: input.note,
      });
    });
  }
}
