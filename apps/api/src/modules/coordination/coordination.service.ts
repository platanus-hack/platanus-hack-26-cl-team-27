import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  type AddressedFinding,
  isChangeNotice,
} from '@team27/context-notification';
import { InlineFactExtractor } from '@team27/context-lake/adapters';
import type { PrismaClient } from '@team27/data-main';

import type { ProjectCatalog } from '../project/project-catalog.ts';
import { UnitOfWork } from '../database/unit-of-work.ts';
import { buildImpact } from '../impact/impact.module.ts';
import { buildLake } from '../lake/lake.module.ts';
import { buildNotification } from '../notification/notification.module.ts';
import {
  type ChunkDraft,
  type Decision,
  formatValue,
  type IngestedRevision,
  isLiveOverlap,
  type Overlap,
  type OverlapVoteKind,
  type ProposalDraft,
  type RevisionDraft,
} from '@team27/context-lake';
import { ActionLog } from './action-log.ts';
import { ChunkReader } from './chunk-reader.ts';
import { elementsFromBaseline } from './elements-from-baseline.ts';
import { diffEvents, type EventDraft, emitEvents, observe } from './events.ts';
import { fail } from './http-errors.ts';
import { underAnalysisOf } from './impact.ts';
import { conflictToNotify, overlapClashes } from './notices.ts';
import {
  checkRevision,
  knownDocument,
  type RawChunk,
  type RevisionInput,
} from './revision-body.ts';
import { revisionTitle } from './lookup.ts';
import { QueryService } from './query.service.ts';
import {
  blockedByOverlap,
  overlapTitle,
  overlapView,
  progressOf,
  printable,
  proposalTitle,
  proposalView,
  staleRefs,
  voteProposal,
  projectVersion,
} from './views.ts';

type Db = PrismaClient;

export interface VoteInput {
  readonly kind: 'reviewed' | 'issue';
  readonly note?: string | null | undefined;
}

export interface VoteOverlapInput {
  readonly kind: OverlapVoteKind;
  readonly note?: string | null | undefined;
}

export interface OpenedProposal {
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

const money = new Intl.NumberFormat('es-CL');

const costSuffix = (proposal: {
  costDelta: number;
  delayDays: number;
}): string => {
  const parts: string[] = [];
  if (proposal.costDelta !== 0) {
    parts.push(
      `${proposal.costDelta > 0 ? '+' : '-'}$${money.format(Math.abs(proposal.costDelta))}`,
    );
  }
  if (proposal.delayDays !== 0) {
    parts.push(
      `${proposal.delayDays > 0 ? '+' : '-'}${Math.abs(proposal.delayDays)} ${Math.abs(proposal.delayDays) === 1 ? 'día' : 'días'}`,
    );
  }
  return parts.length > 0 ? ` (${parts.join(' · ')})` : '';
};

const lockProposal = async (db: Db, id: string): Promise<void> => {
  await db.$queryRaw`SELECT id FROM proposals WHERE id = ${id}::uuid FOR UPDATE`;
};

@Injectable()
export class CoordinationService {
  private readonly uow: UnitOfWork;
  private readonly queries: QueryService;
  private readonly reader: ChunkReader;
  private readonly actions = new ActionLog();

  constructor(
    @Inject(UnitOfWork) uow: UnitOfWork,
    @Inject(QueryService) queries: QueryService,
    @Inject(ChunkReader) reader: ChunkReader,
  ) {
    this.uow = uow;
    this.queries = queries;
    this.reader = reader;
  }

  private async track<T>(
    db: Db,
    project: ProjectCatalog,
    work: () => Promise<{ value: T; events: EventDraft[] }>,
  ): Promise<T> {
    const before = await observe(db, project);
    const { value, events } = await work();
    const after = await observe(db, project);
    await emitEvents(db, project.id, [
      ...events,
      ...diffEvents(project, before, after),
    ]);
    return value;
  }

  ingest(input: {
    project: ProjectCatalog;
    actor: string;
    revision: RevisionInput;
    actionId: string | undefined;
  }) {
    const { project, actor, revision } = input;
    const document = knownDocument(project, revision.documentId);
    if (document.ownerId !== actor) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_your_document',
        `${document.name} es de ${project.castName(document.ownerId)}`,
      );
    }
    const raw = checkRevision(project, revision, document);
    return this.actions.once(
      input.actionId,
      `${project.id}:revision:${actor}:${revision.documentId}`,
      () => this.performIngest(project, actor, revision, raw),
    );
  }

  private async performIngest(
    project: ProjectCatalog,
    actor: string,
    revision: RevisionInput,
    raw: RawChunk[],
  ) {
    const chunks = await this.reader.read(
      project,
      knownDocument(project, revision.documentId),
      revision.label,
      raw,
    );
    const draft = project.toRevisionDraft(
      revision.documentId,
      revision.label,
      actor,
      revision.spaceId,
      revision.pointer,
      revision.contentHash,
    );
    const { ingested, proposals, resolved } = await this.uow.run((db) =>
      this.track(db, project, () =>
        this.ingestRevision(
          db,
          project,
          draft,
          chunks,
          'Ese documento ya está en el repositorio',
          (result) => ({
            kind: 'revision.received',
            message: `${project.castName(actor)} subió ${revisionTitle(result.revision)} en ${project.spaceName(revision.spaceId)}.`,
            refs: {
              castId: actor,
              revisionId: result.revision.id,
              spaceId: revision.spaceId,
              documentId: revision.documentId,
            },
          }),
        ),
      ),
    );
    return this.ingestResponse(project, ingested, proposals, resolved);
  }

  private async ingestRevision(
    db: Db,
    project: ProjectCatalog,
    draft: RevisionDraft,
    chunks: ChunkDraft[],
    conflict: string,
    lead: (result: IngestedRevision) => EventDraft,
  ) {
    const lake = buildLake(db, project, new InlineFactExtractor(chunks));
    const existing = await lake.ports.revisions.findByKey(
      draft.documentId,
      draft.label,
    );
    if (existing) {
      throw fail(HttpStatus.CONFLICT, 'already_ingested', conflict);
    }
    const result = await lake.ingestRevision.execute(draft);
    return this.announce(db, project, result, [lead(result)]);
  }

  private async announce(
    db: Db,
    project: ProjectCatalog,
    result: IngestedRevision,
    lead: EventDraft[],
  ) {
    const lake = buildLake(db, project);
    const opened: OpenedProposal[] = [];
    if (result.draft) {
      opened.push(await this.openProposal(db, project, result.draft));
    }
    const resolved = (await lake.resolveOverlaps.execute()).map(
      (overlap) => overlap.id,
    );
    const openedOverlaps = await lake.openOverlaps.execute({
      revisionId: result.revision.id,
      proposalIds: opened.map((proposal) => proposal.id),
    });
    const settled = await lake.settleOverlaps.execute();
    resolved.push(...settled.resolved.map((overlap) => overlap.id));
    await this.attachClashes(db, project, opened);
    await this.notifyConflicts(db, project, openedOverlaps);
    const title = revisionTitle(result.revision);
    const events: EventDraft[] = [
      ...lead,
      ...result.openedDiscrepancies.map((discrepancy): EventDraft => ({
        kind: 'discrepancy.opened',
        message: `${title} dice ${formatValue(printable(discrepancy.value), discrepancy.unit)} en ${project.factLabel(discrepancy.subject, discrepancy.attribute)} y lo vigente es ${formatValue(printable(discrepancy.baselineValue), discrepancy.unit)}. Le avisamos a ${project.castName(discrepancy.ownerId)}.`,
        refs: {
          discrepancyId: discrepancy.id,
          castId: discrepancy.ownerId,
        },
      })),
      ...result.backedDiscrepancies.map((discrepancy): EventDraft => ({
        kind: 'discrepancy.backed',
        message: `${title} respaldó lo que decía ${project.documentDef(discrepancy.documentId)?.name ?? 'otro documento'} sobre ${project.factLabel(discrepancy.subject, discrepancy.attribute)}.`,
        refs: { discrepancyId: discrepancy.id },
      })),
      ...opened.map((proposal): EventDraft => ({
        kind: 'proposal.opened',
        message: `Nueva propuesta (el PR de la obra): ${proposal.title}${costSuffix(proposal)}. Avisamos a ${proposal.reviewers.length} de ${project.stakeholders.length}.`,
        refs: {
          proposalId: proposal.id,
          castIds: [...proposal.reviewers],
        },
      })),
    ];
    return {
      value: { ingested: result, proposals: opened, resolved },
      events,
    };
  }

  private async attachClashes(
    db: Db,
    project: ProjectCatalog,
    opened: readonly OpenedProposal[],
  ): Promise<void> {
    if (opened.every((proposal) => proposal.changeId === null)) return;
    const lake = buildLake(db, project);
    const [overlaps, proposals] = await Promise.all([
      lake.ports.overlaps.list(),
      lake.ports.proposals.list(),
    ]);
    const impacts = await buildImpact(db, project).getImpacts.execute([
      ...new Set(proposals.flatMap((proposal) => proposal.changeIds)),
    ]);
    const notification = buildNotification(db, project);
    for (const proposal of opened) {
      if (proposal.changeId === null) continue;
      await notification.attachClashes.execute({
        changeId: proposal.changeId,
        clashes: overlapClashes({
          project,
          overlaps,
          proposals,
          impacts: new Map(impacts.map((impact) => [impact.changeId, impact])),
          proposalId: proposal.id,
          changeId: proposal.changeId,
        }),
      });
    }
  }

  private async notifyConflicts(
    db: Db,
    project: ProjectCatalog,
    opened: readonly Overlap[],
  ): Promise<void> {
    if (opened.length === 0) return;
    const lake = buildLake(db, project);
    const [overlaps, proposals, revisions] = await Promise.all([
      lake.ports.overlaps.list(),
      lake.ports.proposals.list(),
      lake.ports.revisions.list(),
    ]);
    const impacts = await buildImpact(db, project).getImpacts.execute([
      ...new Set(proposals.flatMap((proposal) => proposal.changeIds)),
    ]);
    const notification = buildNotification(db, project);
    const openedIds = new Set(opened.map((overlap) => overlap.id));
    for (const overlap of overlaps) {
      if (!openedIds.has(overlap.id) || !isLiveOverlap(overlap)) continue;
      const conflict = conflictToNotify({
        project,
        overlap,
        proposals,
        revisions,
        impacts: new Map(impacts.map((impact) => [impact.changeId, impact])),
      });
      if (conflict) await notification.notifyConflict.execute(conflict);
    }
  }

  private async openProposal(
    db: Db,
    project: ProjectCatalog,
    draft: ProposalDraft,
  ): Promise<OpenedProposal> {
    const lake = buildLake(db, project);
    const impact = buildImpact(db, project);
    const notification = buildNotification(db, project);

    const baseline = await lake.ports.baseline.list();
    const subjects = new Set(draft.changes.map((change) => change.subject));
    const base = elementsFromBaseline(project.model, baseline).filter(
      (element) => subjects.has(element.id),
    );
    const next = elementsFromBaseline(
      project.model,
      baseline,
      draft.after,
    ).filter((element) => subjects.has(element.id));
    const changes = await lake.detectChanges.execute({
      sourceId: draft.sourceRevisionId,
      base,
      next,
    });

    const findings: AddressedFinding[] = [];
    const filteredBy = new Map<string, string[]>();
    let costDelta = 0;
    let delayDays = 0;
    for (const change of changes) {
      const analysis = await impact.analyzeChange.execute(
        underAnalysisOf(change),
      );
      findings.push(...analysis.findings);
      for (const item of analysis.filtered) {
        const reasons = filteredBy.get(item.stakeholderId) ?? [];
        if (!reasons.includes(item.reason)) reasons.push(item.reason);
        filteredBy.set(item.stakeholderId, reasons);
      }
      costDelta += analysis.costDelta;
      delayDays += analysis.delayDays;
    }

    const [primary] = changes;
    let reviewerIds: string[] = [];
    if (primary) {
      const notified = await notification.notifyStakeholders.execute({
        projectId: project.id,
        changeId: primary.id,
        title: changes
          .map((change) => `${change.element.name} · ${change.summary}`)
          .join(' + '),
        findings,
        impact: { costDelta, delayDays },
      });
      const notifiedIds = new Set(notified.map((item) => item.stakeholderId));
      reviewerIds = [
        ...new Set(findings.map((finding) => finding.stakeholderId)),
      ].filter((id) => notifiedIds.has(id));
    }
    const filtered = [...filteredBy.entries()]
      .filter(([id]) => !reviewerIds.includes(id))
      .map(([id, reasons]) => ({ id, reason: reasons.join(' ') }));

    const { proposal } = await lake.openProposal.execute({
      draft,
      changeId: primary?.id ?? null,
      changeIds: changes.map((change) => change.id),
      reviewerIds,
      filtered,
      deferMerge: true,
    });
    return {
      id: proposal.id,
      changeId: primary?.id ?? null,
      title: proposalTitle(project, proposal),
      costDelta,
      delayDays,
      reviewers: reviewerIds,
      filtered: filtered.map((item) => ({
        stakeholderId: item.id,
        reason: item.reason,
      })),
    };
  }

  private async ingestResponse(
    project: ProjectCatalog,
    ingested: IngestedRevision,
    proposals: readonly OpenedProposal[],
    resolved: readonly string[],
  ) {
    const snapshot = await this.queries.snapshot(project);
    const views = new Map(
      snapshot.proposals.map((proposal) => [
        proposal.id,
        proposalView(snapshot, proposal),
      ]),
    );
    const revisionOverlaps = snapshot.overlaps.filter(
      (overlap) => overlap.revisionId === ingested.revision.id,
    );
    return {
      revisionId: ingested.revision.id,
      claims: ingested.outcomes.map((outcome) => ({
        subjectId: outcome.claim.subject,
        attribute: outcome.claim.attribute,
        value: outcome.claim.value,
        confidence: outcome.claim.confidence,
        locator: outcome.claim.locator,
        outcome: OUTCOME[outcome.kind],
      })),
      chunks: ingested.chunks.map((chunk) => ({
        locator: chunk.locator,
        kind: chunk.kind,
        source: chunk.text === null ? 'estructurado' : 'inferencia',
        claims: ingested.claims.filter((claim) => claim.chunkId === chunk.id)
          .length,
        rejected: chunk.rejected.map((item) => ({
          subjectId: item.subject,
          attribute: item.attribute,
          value: item.value,
          confidence: item.confidence,
          reason: item.reason,
        })),
      })),
      proposals: proposals.map((proposal) => {
        const view = views.get(proposal.id);
        const stored = snapshot.proposals.find(
          (item) => item.id === proposal.id,
        );
        return {
          ...proposal,
          documentId: ingested.revision.documentId,
          label: ingested.revision.label,
          authorId: ingested.revision.authorId,
          status: view?.status ?? 'open',
          hunks: view?.hunks ?? [],
          unchangedHunks: view?.unchangedHunks ?? 0,
          blockedByOverlap: stored ? blockedByOverlap(snapshot, stored) : false,
          waitingFor: view?.waitingFor ?? null,
        };
      }),
      overlaps: revisionOverlaps.map((overlap) =>
        overlapView(snapshot, overlap),
      ),
      resolvedOverlaps: [...resolved],
      discrepancies: ingested.openedDiscrepancies.map((discrepancy) => ({
        id: discrepancy.id,
        ownerId: discrepancy.ownerId,
      })),
      backed: ingested.backedDiscrepancies.map((discrepancy) => discrepancy.id),
      stale: staleRefs(snapshot.consensus.stale),
    };
  }

  vote(input: {
    project: ProjectCatalog;
    actor: string;
    notificationId: string;
    vote: VoteInput;
    actionId: string | undefined;
  }) {
    const { project, actor } = input;
    return this.actions.once(
      input.actionId,
      `${project.id}:vote:${actor}:${input.notificationId}`,
      () => this.performVote(project, actor, input.notificationId, input.vote),
    );
  }

  private async performVote(
    project: ProjectCatalog,
    actor: string,
    notificationId: string,
    vote: VoteInput,
  ) {
    const { proposalId, notification } = await this.uow.run((db) =>
      this.track(db, project, () =>
        this.castVote(db, project, actor, notificationId, vote),
      ),
    );
    const snapshot = await this.queries.snapshot(project);
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
      proposal: voteProposal(project, proposal),
      merged: proposal.status === 'merged',
      stale: staleRefs(snapshot.consensus.stale),
      projectVersion: projectVersion(snapshot),
    };
  }

  private async castVote(
    db: Db,
    project: ProjectCatalog,
    actor: string,
    notificationId: string,
    vote: VoteInput,
  ) {
    const lake = buildLake(db, project);
    const notifications = buildNotification(db, project);
    const found = await notifications.getNotification.execute(notificationId);
    if (!found) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe el aviso ${notificationId}`,
      );
    }
    if (found.stakeholderId !== actor) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_your_notification',
        'Ese aviso no es para ti',
      );
    }
    if (!isChangeNotice(found)) {
      throw fail(
        HttpStatus.CONFLICT,
        'invalid_state',
        'Ese aviso es de un choque: se responde validando el solapamiento',
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
    const decision: Decision = vote.kind === 'reviewed' ? 'approve' : 'dispute';
    const recorded = await lake.recordReview.execute({
      proposalId: target.id,
      reviewerId: actor,
      decision,
      note: vote.note ?? null,
    });
    const updated = recorded.changed
      ? await notifications.respondToNotification.execute(notificationId, {
          kind: vote.kind,
          note: vote.note ?? null,
        })
      : found;
    await lake.settleOverlaps.execute();
    const events: EventDraft[] = [];
    if (recorded.changed) {
      const progress = progressOf(project, recorded.proposal);
      const title = proposalTitle(project, recorded.proposal);
      if (decision === 'approve') {
        events.push({
          kind: 'review.approved',
          message: `${project.castName(actor)} aprobó ${title} (${progress.approved} de ${progress.required}).`,
          refs: { proposalId: target.id, castId: actor },
        });
      } else {
        const note = vote.note?.trim();
        events.push({
          kind: 'proposal.disputed',
          message: `${project.castName(actor)} tiene un problema con ${title}${note ? `: «${note}»` : ''}. Lo vigente no cambia.`,
          refs: { proposalId: target.id, castId: actor },
        });
      }
    }
    return {
      value: { proposalId: target.id, notification: updated ?? found },
      events,
    };
  }

  voteOverlap(input: {
    project: ProjectCatalog;
    actor: string;
    overlapId: string;
    vote: VoteOverlapInput;
    actionId: string | undefined;
  }) {
    const { project, actor, overlapId } = input;
    return this.actions.once(
      input.actionId,
      `${project.id}:overlap:${actor}:${overlapId}`,
      () => this.performOverlapVote(project, actor, overlapId, input.vote),
    );
  }

  private async performOverlapVote(
    project: ProjectCatalog,
    actor: string,
    overlapId: string,
    vote: VoteOverlapInput,
  ) {
    const proposalId = await this.uow.run((db) =>
      this.track(db, project, async () => {
        const lake = buildLake(db, project);
        const found = await lake.ports.overlaps.findById(overlapId);
        if (!found) {
          throw fail(
            HttpStatus.NOT_FOUND,
            'not_found',
            `No existe el solapamiento ${overlapId}`,
          );
        }
        if (!found.validators.includes(actor)) {
          throw fail(
            HttpStatus.FORBIDDEN,
            'not_validator',
            'Solo validan este solapamiento quienes son dueños de los dos lados',
          );
        }
        if (found.proposalId) await lockProposal(db, found.proposalId);
        const voted = await lake.voteOverlap.execute({
          overlapId,
          validatorId: actor,
          kind: vote.kind,
          note: vote.note ?? null,
        });
        await lake.settleOverlaps.execute();
        const events: EventDraft[] = [];
        if (voted.changed) {
          const title = overlapTitle(
            project,
            voted.overlap,
            await lake.ports.revisions.list(),
          );
          const note = vote.note?.trim();
          events.push({
            kind: 'overlap.voted',
            message: `${project.castName(actor)} dice que ${vote.kind === 'se_tocan' ? 'se tocan' : 'no se tocan'} ${title}${note ? `: «${note}»` : ''}.`,
            refs: { overlapId, castId: actor },
          });
        }
        return { value: found.proposalId, events };
      }),
    );
    const snapshot = await this.queries.snapshot(project);
    const overlap = snapshot.overlaps.find((item) => item.id === overlapId);
    const proposal = snapshot.proposals.find((item) => item.id === proposalId);
    if (!overlap) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        'El solapamiento ya no existe',
      );
    }
    return {
      overlap: overlapView(snapshot, overlap),
      proposal: proposal ? proposalView(snapshot, proposal) : null,
      merged: proposal?.status === 'merged',
      stale: staleRefs(snapshot.consensus.stale),
      projectVersion: projectVersion(snapshot),
    };
  }

  async reopen(input: {
    project: ProjectCatalog;
    actor: string;
    proposalId: string;
  }) {
    const { project, actor } = input;
    await this.uow.run((db) =>
      this.track(db, project, async () => {
        const lake = buildLake(db, project);
        const notifications = buildNotification(db, project);
        await this.authorOf(db, project, input.proposalId, actor);
        await lockProposal(db, input.proposalId);
        const { proposal, reopenedReviewerIds } =
          await lake.reopenProposal.execute({
            proposalId: input.proposalId,
            actorId: actor,
          });
        if (proposal.changeId !== null) {
          for (const reviewerId of reopenedReviewerIds) {
            const [notification] =
              await notifications.listNotifications.execute({
                changeIds: [proposal.changeId],
                stakeholderId: reviewerId,
                kind: 'change',
              });
            if (notification) {
              await notifications.reopenResponse.execute(notification.id);
            }
          }
        }
        const pending = reopenedReviewerIds
          .map((id) => project.castName(id))
          .join(', ');
        return {
          value: undefined,
          events: [
            {
              kind: 'proposal.reopened',
              message: `${project.castName(actor)} reabrió ${proposalTitle(project, proposal)} con la observación. Vuelve a responder ${pending || 'nadie'}.`,
              refs: {
                proposalId: proposal.id,
                castIds: [...reopenedReviewerIds],
              },
            },
          ],
        };
      }),
    );
    return this.queries.proposal(project, input.proposalId);
  }

  async withdraw(input: {
    project: ProjectCatalog;
    actor: string;
    proposalId: string;
  }) {
    const { project, actor } = input;
    await this.uow.run((db) =>
      this.track(db, project, async () => {
        await this.authorOf(db, project, input.proposalId, actor);
        await lockProposal(db, input.proposalId);
        const lake = buildLake(db, project);
        await lake.withdrawProposal.execute({
          proposalId: input.proposalId,
          actorId: actor,
        });
        await lake.settleOverlaps.execute();
        return { value: undefined, events: [] };
      }),
    );
    return this.queries.proposal(project, input.proposalId);
  }

  private async authorOf(
    db: Db,
    project: ProjectCatalog,
    proposalId: string,
    actor: string,
  ): Promise<void> {
    const proposal = await buildLake(db, project).ports.proposals.findById(
      proposalId,
    );
    if (!proposal) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe la propuesta ${proposalId}`,
      );
    }
    if (proposal.authorId !== actor) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_author',
        `Solo ${project.castName(proposal.authorId)} puede hacerlo`,
      );
    }
  }

  async dismiss(input: {
    project: ProjectCatalog;
    actor: string;
    discrepancyId: string;
    note?: string | null | undefined;
  }): Promise<void> {
    const { project, actor } = input;
    await this.uow.run((db) =>
      this.track(db, project, async () => {
        const lake = buildLake(db, project);
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
        if (discrepancy.ownerId !== actor) {
          throw fail(
            HttpStatus.FORBIDDEN,
            'not_owner',
            'Solo el dueño del valor descarta la discrepancia',
          );
        }
        const already = discrepancy.status === 'dismissed';
        await lake.dismissDiscrepancy.execute({
          discrepancyId: input.discrepancyId,
          actorId: actor,
          note: input.note ?? null,
        });
        return {
          value: undefined,
          events: already
            ? []
            : [
                {
                  kind: 'discrepancy.dismissed',
                  message: `${project.castName(actor)} descartó la discrepancia sobre ${project.factLabel(discrepancy.subject, discrepancy.attribute)}.`,
                  refs: { discrepancyId: discrepancy.id, castId: actor },
                },
              ],
        };
      }),
    );
  }

  async acknowledge(input: {
    project: ProjectCatalog;
    actor: string;
    revisionId: string;
    note: string;
  }): Promise<void> {
    const { project, actor } = input;
    await this.uow.run((db) =>
      this.track(db, project, async () => {
        const lake = buildLake(db, project);
        const revision = await lake.ports.revisions.findById(input.revisionId);
        if (!revision) {
          throw fail(
            HttpStatus.NOT_FOUND,
            'not_found',
            `No existe la revisión ${input.revisionId}`,
          );
        }
        if (revision.authorId !== actor) {
          throw fail(
            HttpStatus.FORBIDDEN,
            'not_owner',
            'Solo el dueño del documento confirma sin cambio',
          );
        }
        const current = await lake.consensus.execute();
        const already = current.stale.some(
          (document) =>
            document.documentId === revision.documentId &&
            document.acknowledgement !== null,
        );
        await lake.acknowledgeStale.execute({
          documentId: revision.documentId,
          ownerId: actor,
          note: input.note,
        });
        return {
          value: undefined,
          events: already
            ? []
            : [
                {
                  kind: 'stale.acknowledged',
                  message: `${project.castName(actor)} confirmó sin cambio ${revisionTitle(revision)}.`,
                  refs: { revisionId: revision.id, castId: actor },
                },
              ],
        };
      }),
    );
  }
}
