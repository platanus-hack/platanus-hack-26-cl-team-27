import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { AddressedFinding } from '@team27/context-notification';
import { InlineFactExtractor } from '@team27/context-lake/adapters';
import type { PrismaClient } from '@team27/data-main';

import type { ProjectCatalog } from '../project/project-catalog.ts';
import { PROJECT_CATALOG } from '../project/project.module.ts';
import { UnitOfWork } from '../database/unit-of-work.ts';
import {
  diffEvents,
  type EventDraft,
  emitEvents,
  observe,
} from '../room/events.ts';
import { readState } from '../room/state.ts';
import { buildImpact } from '../impact/impact.module.ts';
import { buildLake } from '../lake/lake.module.ts';
import { buildNotification } from '../notification/notification.module.ts';
import {
  type ChunkDraft,
  type Decision,
  formatValue,
  type IngestedRevision,
  type OverlapVoteKind,
  type ProposalDraft,
  type RevisionDraft,
} from '@team27/context-lake';
import { CASE_DOCUMENT_IDS } from '../../scenario/caso-p12.ts';
import { ActionLog } from './action-log.ts';
import { ChunkReader } from './chunk-reader.ts';
import { elementsFromBaseline } from './elements-from-baseline.ts';
import { fail } from './http-errors.ts';
import {
  checkAuthor,
  checkRevision,
  knownDocument,
  type RawChunk,
  type RevisionInput,
  type SeedInput,
} from './revision-body.ts';
import { revisionTitle } from './lookup.ts';
import { QueryService } from './query.service.ts';
import {
  mapMinute,
  modelDocumentOf,
  type MappedMinute,
  type RevitMinute,
} from './revit-minute.ts';
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

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

const minuteSummary = (
  ingested: IngestedRevision,
  proposals: readonly OpenedProposal[],
  mapped: MappedMinute,
  stakeholders: number,
): string => {
  const label = ingested.revision.label;
  const head = `${label.startsWith('guardado') ? `La minuta del ${label}` : 'La minuta'} trae ${plural(mapped.claims.length, 'cambio', 'cambios')}`;
  const unchanged = ingested.outcomes.every(
    (outcome) => outcome.kind === 'same' || outcome.kind === 'corroborates',
  );
  let body: string;
  if (proposals.length > 0) {
    const notified = new Set(
      proposals.flatMap((proposal) => proposal.reviewers),
    );
    body = `abrimos ${plural(proposals.length, 'propuesta', 'propuestas')} y avisamos a ${notified.size} de ${stakeholders}.`;
  } else if (unchanged) {
    body = 'la obra ya tenía esos valores, no abrimos propuestas.';
  } else {
    body = 'no abrimos propuestas.';
  }
  const skipped = mapped.ignored.length;
  const tail =
    skipped === 0
      ? ''
      : skipped === 1
        ? ' 1 cambio no entró.'
        : ` ${skipped} cambios no entraron.`;
  return `${head}: ${body}${tail}`;
};

const lockProposal = async (db: Db, id: string): Promise<void> => {
  await db.$queryRaw`SELECT id FROM proposals WHERE id = ${id}::uuid FOR UPDATE`;
};

@Injectable()
export class CoordinationService {
  private readonly uow: UnitOfWork;
  private readonly queries: QueryService;
  private readonly reader: ChunkReader;
  private readonly project: ProjectCatalog;
  private readonly actions = new ActionLog();

  constructor(
    @Inject(UnitOfWork) uow: UnitOfWork,
    @Inject(QueryService) queries: QueryService,
    @Inject(ChunkReader) reader: ChunkReader,
    @Inject(PROJECT_CATALOG) project: ProjectCatalog,
  ) {
    this.uow = uow;
    this.queries = queries;
    this.reader = reader;
    this.project = project;
  }

  async reset(): Promise<void> {
    await this.uow.run(async (db) => {
      const state = await readState(db, this.project.id);
      await db.roomEvent.deleteMany({ where: { projectId: this.project.id } });
      await db.seat.deleteMany({ where: { projectId: this.project.id } });
      await db.notification.deleteMany({
        where: { projectId: this.project.id },
      });
      await db.impact.deleteMany({ where: { projectId: this.project.id } });
      await db.change.deleteMany({ where: { projectId: this.project.id } });
      await buildLake(db, this.project).seedLake.execute({ revisions: [] });
      await db.roomState.update({
        where: { projectId: this.project.id },
        data: { epoch: state.epoch + 1 },
      });
      await emitEvents(db, this.project.id, [
        { kind: 'room.reset', message: 'La sala volvió al comienzo.' },
      ]);
    });
    this.actions.clear();
  }

  async seed(input: SeedInput) {
    const keys = new Set<string>();
    const revisions: { revision: RevisionDraft; chunks: ChunkDraft[] }[] = [];
    for (const item of input.revisions) {
      const document = knownDocument(this.project, item.documentId);
      checkAuthor(this.project, item.authorId);
      const raw = checkRevision(this.project, item, document);
      const key = `${item.documentId}\u0000${item.label}`;
      if (keys.has(key)) {
        throw fail(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'duplicate_revision',
          `La carga repite ${document.name} ${item.label}`,
        );
      }
      keys.add(key);
      revisions.push({
        revision: this.project.toRevisionDraft(
          item.documentId,
          item.label,
          item.authorId,
          item.spaceId,
          item.pointer,
          item.contentHash,
        ),
        chunks: await this.reader.read(document, item.label, raw),
      });
    }
    const seeded = await this.uow.run(async (db) => {
      const lake = buildLake(db, this.project);
      const loaded = (await lake.ports.revisions.list()).filter(
        (revision) => !CASE_DOCUMENT_IDS.includes(revision.documentId),
      );
      if (loaded.length > 0) {
        throw fail(
          HttpStatus.CONFLICT,
          'lake_not_empty',
          'La carga inicial solo vale con el lago vacío: reinicia la sala antes',
        );
      }
      const result = await lake.seedLake.execute({ revisions });
      await emitEvents(db, this.project.id, [
        {
          kind: 'lake.seeded',
          message: `Se cargó lo vigente de la obra: ${plural(result.revisions, 'documento', 'documentos')}.`,
          refs: { revisions: result.revisions },
        },
      ]);
      return result;
    });
    return {
      revisions: seeded.revisions,
      baseline: seeded.baseline.length,
    };
  }

  private async track<T>(
    db: Db,
    work: () => Promise<{ value: T; events: EventDraft[] }>,
  ): Promise<T> {
    const before = await observe(db, this.project);
    const { value, events } = await work();
    const after = await observe(db, this.project);
    await emitEvents(db, this.project.id, [
      ...events,
      ...diffEvents(this.project, before, after),
    ]);
    return value;
  }

  ingest(input: {
    seat: string;
    revision: RevisionInput;
    actionId: string | undefined;
  }) {
    const { seat, revision } = input;
    const document = knownDocument(this.project, revision.documentId);
    if (document.ownerId !== seat) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_your_document',
        `${document.name} es de ${this.project.castName(document.ownerId)}`,
      );
    }
    const raw = checkRevision(this.project, revision, document);
    return this.actions.once(
      input.actionId,
      `revision:${seat}:${revision.documentId}`,
      () => this.performIngest(seat, revision, raw),
    );
  }

  private async performIngest(
    seat: string,
    revision: RevisionInput,
    raw: RawChunk[],
  ) {
    const chunks = await this.reader.read(
      knownDocument(this.project, revision.documentId),
      revision.label,
      raw,
    );
    const draft = this.project.toRevisionDraft(
      revision.documentId,
      revision.label,
      seat,
      revision.spaceId,
      revision.pointer,
      revision.contentHash,
    );
    const { ingested, proposals, resolved } = await this.uow.run((db) =>
      this.track(db, () =>
        this.ingestRevision(
          db,
          draft,
          chunks,
          'Ese documento ya está en el repositorio',
          (result) => ({
            kind: 'revision.received',
            message: `${this.project.castName(seat)} subió ${revisionTitle(result.revision)} en ${this.project.spaceName(revision.spaceId)}.`,
            refs: {
              castId: seat,
              revisionId: result.revision.id,
              spaceId: revision.spaceId,
              documentId: revision.documentId,
            },
          }),
        ),
      ),
    );
    return this.ingestResponse(ingested, proposals, resolved);
  }

  private async ingestRevision(
    db: Db,
    draft: RevisionDraft,
    chunks: ChunkDraft[],
    conflict: string,
    lead: (result: IngestedRevision) => EventDraft,
  ) {
    const lake = buildLake(db, this.project, new InlineFactExtractor(chunks));
    const existing = await lake.ports.revisions.findByKey(
      draft.documentId,
      draft.label,
    );
    if (existing) {
      throw fail(HttpStatus.CONFLICT, 'already_ingested', conflict);
    }
    const result = await lake.ingestRevision.execute(draft);
    return this.announce(db, result, [lead(result)]);
  }

  private async announce(db: Db, result: IngestedRevision, lead: EventDraft[]) {
    const lake = buildLake(db, this.project);
    const opened: OpenedProposal[] = [];
    if (result.draft) opened.push(await this.openProposal(db, result.draft));
    const resolved = (await lake.resolveOverlaps.execute()).map(
      (overlap) => overlap.id,
    );
    await lake.openOverlaps.execute({
      revisionId: result.revision.id,
      proposalIds: opened.map((proposal) => proposal.id),
    });
    const settled = await lake.settleOverlaps.execute();
    resolved.push(...settled.resolved.map((overlap) => overlap.id));
    const title = revisionTitle(result.revision);
    const events: EventDraft[] = [
      ...lead,
      ...result.openedDiscrepancies.map((discrepancy): EventDraft => ({
        kind: 'discrepancy.opened',
        message: `${title} dice ${formatValue(printable(discrepancy.value), discrepancy.unit)} en ${this.project.factLabel(discrepancy.subject, discrepancy.attribute)} y lo vigente es ${formatValue(printable(discrepancy.baselineValue), discrepancy.unit)}. Le avisamos a ${this.project.castName(discrepancy.ownerId)}.`,
        refs: {
          discrepancyId: discrepancy.id,
          castId: discrepancy.ownerId,
        },
      })),
      ...result.backedDiscrepancies.map((discrepancy): EventDraft => ({
        kind: 'discrepancy.backed',
        message: `${title} respaldó lo que decía ${this.project.documentDef(discrepancy.documentId)?.name ?? 'otro documento'} sobre ${this.project.factLabel(discrepancy.subject, discrepancy.attribute)}.`,
        refs: { discrepancyId: discrepancy.id },
      })),
      ...opened.map((proposal): EventDraft => ({
        kind: 'proposal.opened',
        message: `Nueva propuesta (el PR de la obra): ${proposal.title}${costSuffix(proposal)}. Avisamos a ${proposal.reviewers.length} de ${this.project.stakeholders.length}.`,
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

  private async openProposal(
    db: Db,
    draft: ProposalDraft,
  ): Promise<OpenedProposal> {
    const lake = buildLake(db, this.project);
    const impact = buildImpact(db, this.project);
    const notification = buildNotification(db, this.project);

    const baseline = await lake.ports.baseline.list();
    const subjects = new Set(draft.changes.map((change) => change.subject));
    const base = elementsFromBaseline(this.project.model, baseline).filter(
      (element) => subjects.has(element.id),
    );
    const next = elementsFromBaseline(
      this.project.model,
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
      const analysis = await impact.analyzeChange.execute({
        id: change.id,
        elementId: change.element.id,
        elementName: change.element.name,
        category: change.element.category,
        changedKeys: change.diffs.map((diff) => diff.key),
        before: change.before,
        after: change.after,
      });
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
        changeId: primary.id,
        title: changes
          .map((change) => `${change.element.name} · ${change.summary}`)
          .join(' + '),
        findings,
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
      title: proposalTitle(this.project, proposal),
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
    ingested: IngestedRevision,
    proposals: readonly OpenedProposal[],
    resolved: readonly string[],
  ) {
    const snapshot = await this.queries.snapshot();
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

  receiveMinute(input: { seat: string; minute: RevitMinute }) {
    const { seat, minute } = input;
    const owner = modelDocumentOf(this.project).ownerId;
    if (seat !== owner) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_your_document',
        `El modelo de Revit es de ${this.project.castName(owner)}`,
      );
    }
    const mapped = mapMinute(this.project, minute, seat);
    if (mapped.claims.length === 0) {
      throw new HttpException(
        {
          code: 'minute_empty',
          message:
            'Ningún cambio de la minuta corresponde a valores que siga el proyecto',
          ignored: mapped.ignored,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return this.actions.once(minute.minuteId, `minute:${seat}`, () =>
      this.performMinute(seat, minute.minuteId, mapped),
    );
  }

  private async performMinute(
    seat: string,
    minuteId: string,
    mapped: MappedMinute,
  ) {
    const { ingested, proposals, resolved } = await this.uow.run((db) =>
      this.track(db, () => this.ingestMinute(db, seat, minuteId, mapped)),
    );
    const response = await this.ingestResponse(ingested, proposals, resolved);
    return {
      minuteId,
      revisionId: response.revisionId,
      documentId: ingested.revision.documentId,
      label: ingested.revision.label,
      title: revisionTitle(ingested.revision),
      claims: response.claims,
      proposals: response.proposals.map((proposal) => ({
        id: proposal.id,
        changeId: proposal.changeId,
        title: proposal.title,
        costDelta: proposal.costDelta,
        delayDays: proposal.delayDays,
        reviewers: proposal.reviewers.map((id) => ({
          id,
          name: this.project.castName(id),
        })),
        filtered: proposal.filtered.map((item) => ({
          stakeholderId: item.stakeholderId,
          name: this.project.castName(item.stakeholderId),
          reason: item.reason,
        })),
        link: proposal.changeId ? `/cambios/${proposal.changeId}` : null,
        documentId: proposal.documentId,
        label: proposal.label,
        authorId: proposal.authorId,
        status: proposal.status,
        hunks: proposal.hunks,
        unchangedHunks: proposal.unchangedHunks,
        blockedByOverlap: proposal.blockedByOverlap,
        waitingFor: proposal.waitingFor,
      })),
      overlaps: response.overlaps,
      resolvedOverlaps: response.resolvedOverlaps,
      chunks: response.chunks,
      discrepancies: response.discrepancies,
      backed: response.backed,
      stale: response.stale,
      ignored: mapped.ignored,
      summary: minuteSummary(
        ingested,
        proposals,
        mapped,
        this.project.stakeholders.length,
      ),
    };
  }

  private ingestMinute(
    db: Db,
    seat: string,
    minuteId: string,
    mapped: MappedMinute,
  ) {
    const { label, spaceId } = mapped.revision;
    return this.ingestRevision(
      db,
      mapped.revision,
      mapped.chunks,
      `Ya hay una revisión «${label}» del modelo en el repositorio`,
      (result) => ({
        kind: 'minute.received',
        message: `${this.project.castName(seat)} guardó el modelo en Revit (${label}): la minuta trae ${plural(mapped.claims.length, 'cambio', 'cambios')}.`,
        refs: {
          castId: seat,
          revisionId: result.revision.id,
          spaceId,
          minuteId,
        },
      }),
    );
  }

  vote(input: {
    seat: string;
    notificationId: string;
    vote: VoteInput;
    actionId: string | undefined;
  }) {
    const seat = input.seat;
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
    const { proposalId, notification } = await this.uow.run((db) =>
      this.track(db, () => this.castVote(db, seat, notificationId, vote)),
    );
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
      proposal: voteProposal(this.project, proposal),
      merged: proposal.status === 'merged',
      stale: staleRefs(snapshot.consensus.stale),
      projectVersion: projectVersion(snapshot),
    };
  }

  private async castVote(
    db: Db,
    seat: string,
    notificationId: string,
    vote: VoteInput,
  ) {
    const lake = buildLake(db, this.project);
    const notifications = buildNotification(db, this.project);
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
    const decision: Decision = vote.kind === 'reviewed' ? 'approve' : 'dispute';
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
    await lake.settleOverlaps.execute();
    const events: EventDraft[] = [];
    if (recorded.changed) {
      const progress = progressOf(this.project, recorded.proposal);
      const title = proposalTitle(this.project, recorded.proposal);
      if (decision === 'approve') {
        events.push({
          kind: 'review.approved',
          message: `${this.project.castName(seat)} aprobó ${title} (${progress.approved} de ${progress.required}).`,
          refs: { proposalId: target.id, castId: seat },
        });
      } else {
        const note = vote.note?.trim();
        events.push({
          kind: 'proposal.disputed',
          message: `${this.project.castName(seat)} tiene un problema con ${title}${note ? `: «${note}»` : ''}. Lo vigente no cambia.`,
          refs: { proposalId: target.id, castId: seat },
        });
      }
    }
    return {
      value: { proposalId: target.id, notification: updated ?? found },
      events,
    };
  }

  voteOverlap(input: {
    seat: string;
    overlapId: string;
    vote: VoteOverlapInput;
    actionId: string | undefined;
  }) {
    const { seat, overlapId } = input;
    return this.actions.once(
      input.actionId,
      `overlap:${seat}:${overlapId}`,
      () => this.performOverlapVote(seat, overlapId, input.vote),
    );
  }

  private async performOverlapVote(
    seat: string,
    overlapId: string,
    vote: VoteOverlapInput,
  ) {
    const proposalId = await this.uow.run((db) =>
      this.track(db, async () => {
        const lake = buildLake(db, this.project);
        const found = await lake.ports.overlaps.findById(overlapId);
        if (!found) {
          throw fail(
            HttpStatus.NOT_FOUND,
            'not_found',
            `No existe el solapamiento ${overlapId}`,
          );
        }
        if (!found.validators.includes(seat)) {
          throw fail(
            HttpStatus.FORBIDDEN,
            'not_validator',
            'Solo validan este solapamiento quienes son dueños de los dos lados',
          );
        }
        if (found.proposalId) await lockProposal(db, found.proposalId);
        const voted = await lake.voteOverlap.execute({
          overlapId,
          validatorId: seat,
          kind: vote.kind,
          note: vote.note ?? null,
        });
        await lake.settleOverlaps.execute();
        const events: EventDraft[] = [];
        if (voted.changed) {
          const title = overlapTitle(
            this.project,
            voted.overlap,
            await lake.ports.revisions.list(),
          );
          const note = vote.note?.trim();
          events.push({
            kind: 'overlap.voted',
            message: `${this.project.castName(seat)} dice que ${vote.kind === 'se_tocan' ? 'se tocan' : 'no se tocan'} ${title}${note ? `: «${note}»` : ''}.`,
            refs: { overlapId, castId: seat },
          });
        }
        return { value: found.proposalId, events };
      }),
    );
    const snapshot = await this.queries.snapshot();
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

  async reopen(input: { seat: string; proposalId: string }) {
    const seat = input.seat;
    await this.uow.run((db) =>
      this.track(db, async () => {
        const lake = buildLake(db, this.project);
        const notifications = buildNotification(db, this.project);
        await this.authorOf(db, input.proposalId, seat);
        await lockProposal(db, input.proposalId);
        const { proposal, reopenedReviewerIds } =
          await lake.reopenProposal.execute({
            proposalId: input.proposalId,
            actorId: seat,
          });
        if (proposal.changeId !== null) {
          for (const reviewerId of reopenedReviewerIds) {
            const [notification] =
              await notifications.listNotifications.execute({
                changeIds: [proposal.changeId],
                stakeholderId: reviewerId,
              });
            if (notification) {
              await notifications.reopenResponse.execute(notification.id);
            }
          }
        }
        const pending = reopenedReviewerIds
          .map((id) => this.project.castName(id))
          .join(', ');
        return {
          value: undefined,
          events: [
            {
              kind: 'proposal.reopened',
              message: `${this.project.castName(seat)} reabrió ${proposalTitle(this.project, proposal)} con la observación. Vuelve a responder ${pending || 'nadie'}.`,
              refs: {
                proposalId: proposal.id,
                castIds: [...reopenedReviewerIds],
              },
            },
          ],
        };
      }),
    );
    return this.queries.proposal(input.proposalId);
  }

  async withdraw(input: { seat: string; proposalId: string }) {
    const seat = input.seat;
    await this.uow.run((db) =>
      this.track(db, async () => {
        await this.authorOf(db, input.proposalId, seat);
        await lockProposal(db, input.proposalId);
        const lake = buildLake(db, this.project);
        await lake.withdrawProposal.execute({
          proposalId: input.proposalId,
          actorId: seat,
        });
        await lake.settleOverlaps.execute();
        return { value: undefined, events: [] };
      }),
    );
    return this.queries.proposal(input.proposalId);
  }

  private async authorOf(
    db: Db,
    proposalId: string,
    seat: string,
  ): Promise<void> {
    const proposal = await buildLake(db, this.project).ports.proposals.findById(
      proposalId,
    );
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
        `Solo ${this.project.castName(proposal.authorId)} puede hacerlo`,
      );
    }
  }

  async dismiss(input: {
    seat: string;
    discrepancyId: string;
    note?: string | null | undefined;
  }): Promise<void> {
    const seat = input.seat;
    await this.uow.run((db) =>
      this.track(db, async () => {
        const lake = buildLake(db, this.project);
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
        const already = discrepancy.status === 'dismissed';
        await lake.dismissDiscrepancy.execute({
          discrepancyId: input.discrepancyId,
          actorId: seat,
          note: input.note ?? null,
        });
        return {
          value: undefined,
          events: already
            ? []
            : [
                {
                  kind: 'discrepancy.dismissed',
                  message: `${this.project.castName(seat)} descartó la discrepancia sobre ${this.project.factLabel(discrepancy.subject, discrepancy.attribute)}.`,
                  refs: { discrepancyId: discrepancy.id, castId: seat },
                },
              ],
        };
      }),
    );
  }

  async acknowledge(input: {
    seat: string;
    revisionId: string;
    note: string;
  }): Promise<void> {
    const seat = input.seat;
    await this.uow.run((db) =>
      this.track(db, async () => {
        const lake = buildLake(db, this.project);
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
        const current = await lake.consensus.execute();
        const already = current.stale.some(
          (document) =>
            document.documentId === revision.documentId &&
            document.acknowledgement !== null,
        );
        await lake.acknowledgeStale.execute({
          documentId: revision.documentId,
          ownerId: seat,
          note: input.note,
        });
        return {
          value: undefined,
          events: already
            ? []
            : [
                {
                  kind: 'stale.acknowledged',
                  message: `${this.project.castName(seat)} confirmó sin cambio ${revisionTitle(revision)}.`,
                  refs: { revisionId: revision.id, castId: seat },
                },
              ],
        };
      }),
    );
  }
}
