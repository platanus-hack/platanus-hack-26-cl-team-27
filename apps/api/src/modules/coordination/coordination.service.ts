import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { formatValue } from '@team27/context-capture';
import { InlineFactExtractor } from '@team27/context-lake/adapters';
import type { PrismaClient } from '@team27/data-main';

import {
  documentOf,
  REVIT_MODEL_ID,
  toRevisionDraft,
} from '../../scenario/documents.ts';
import { LOS_AROMOS } from '../../scenario/los-aromos.ts';
import { UnitOfWork } from '../database/unit-of-work.ts';
import {
  diffEvents,
  type EventDraft,
  emitEvents,
  observe,
} from '../room/events.ts';
import { readState, ROOM_STATE_ID } from '../room/state.ts';
import { buildCapture } from '../capture/capture.module.ts';
import { buildImpact } from '../impact/impact.module.ts';
import { buildLake } from '../lake/lake.module.ts';
import { buildNotification } from '../notification/notification.module.ts';
import type {
  ClaimDraft,
  Decision,
  IngestedRevision,
  ProposalDraft,
  RevisionDraft,
} from '@team27/context-lake';
import { ActionLog } from './action-log.ts';
import { elementsFromBaseline } from './elements-from-baseline.ts';
import { fail } from './http-errors.ts';
import {
  checkAuthor,
  checkRevision,
  knownDocument,
  type RevisionInput,
  type SeedInput,
} from './revision-body.ts';
import {
  castName,
  documentDef,
  factLabel,
  revisionTitle,
  spaceName,
} from './lookup.ts';
import { QueryService } from './query.service.ts';
import {
  mapMinute,
  type MappedMinute,
  type RevitMinute,
} from './revit-minute.ts';
import {
  progressOf,
  printable,
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
    body = `abrimos ${plural(proposals.length, 'propuesta', 'propuestas')} y avisamos a ${notified.size} de ${LOS_AROMOS.stakeholders.length}.`;
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
  private readonly actions = new ActionLog();

  constructor(
    @Inject(UnitOfWork) uow: UnitOfWork,
    @Inject(QueryService) queries: QueryService,
  ) {
    this.uow = uow;
    this.queries = queries;
  }

  async reset(): Promise<void> {
    await this.uow.run(async (db) => {
      const state = await readState(db);
      await db.roomEvent.deleteMany();
      await db.seat.deleteMany();
      await db.notification.deleteMany();
      await db.impact.deleteMany();
      await db.change.deleteMany();
      await buildLake(db).seedLake.execute({ revisions: [] });
      await db.roomState.update({
        where: { id: ROOM_STATE_ID },
        data: { epoch: state.epoch + 1 },
      });
      await emitEvents(db, [
        { kind: 'room.reset', message: 'La sala volvió al comienzo.' },
      ]);
    });
    this.actions.clear();
  }

  async seed(input: SeedInput) {
    const seeded = await this.uow.run(async (db) => {
      const lake = buildLake(db);
      if ((await lake.ports.revisions.list()).length > 0) {
        throw fail(
          HttpStatus.CONFLICT,
          'lake_not_empty',
          'La carga inicial solo vale con el lago vacío: reinicia la sala antes',
        );
      }
      const keys = new Set<string>();
      const revisions = input.revisions.map((item) => {
        const document = knownDocument(item.documentId);
        checkAuthor(item.authorId);
        const claims = checkRevision(item, document);
        const key = `${item.documentId}\u0000${item.label}`;
        if (keys.has(key)) {
          throw fail(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'duplicate_revision',
            `La carga repite ${document.name} ${item.label}`,
          );
        }
        keys.add(key);
        return {
          revision: toRevisionDraft(
            item.documentId,
            item.label,
            item.authorId,
            item.spaceId,
            item.pointer,
            item.contentHash,
          ),
          claims,
        };
      });
      const result = await lake.seedLake.execute({ revisions });
      await emitEvents(db, [
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
    const before = await observe(db, proposalTitle);
    const { value, events } = await work();
    const after = await observe(db, proposalTitle);
    await emitEvents(db, [...events, ...diffEvents(before, after)]);
    return value;
  }

  ingest(input: {
    seat: string;
    revision: RevisionInput;
    actionId: string | undefined;
  }) {
    const { seat, revision } = input;
    const document = knownDocument(revision.documentId);
    if (document.ownerId !== seat) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_your_document',
        `${document.name} es de ${castName(document.ownerId)}`,
      );
    }
    const claims = checkRevision(revision, document);
    return this.actions.once(
      input.actionId,
      `revision:${seat}:${revision.documentId}`,
      () => this.performIngest(seat, revision, claims),
    );
  }

  private async performIngest(
    seat: string,
    revision: RevisionInput,
    claims: ClaimDraft[],
  ) {
    const draft = toRevisionDraft(
      revision.documentId,
      revision.label,
      seat,
      revision.spaceId,
      revision.pointer,
      revision.contentHash,
    );
    const { ingested, proposals } = await this.uow.run((db) =>
      this.track(db, () =>
        this.ingestRevision(
          db,
          draft,
          claims,
          'Ese documento ya está en el repositorio',
          (result) => ({
            kind: 'revision.received',
            message: `${castName(seat)} subió ${revisionTitle(result.revision)} en ${spaceName(revision.spaceId)}.`,
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
    return this.ingestResponse(ingested, proposals);
  }

  private async ingestRevision(
    db: Db,
    draft: RevisionDraft,
    claims: ClaimDraft[],
    conflict: string,
    lead: (result: IngestedRevision) => EventDraft,
  ) {
    const lake = buildLake(db, new InlineFactExtractor(claims));
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
    const opened: OpenedProposal[] = [];
    for (const draft of result.drafts) {
      opened.push(await this.openProposal(db, draft));
    }
    const title = revisionTitle(result.revision);
    const events: EventDraft[] = [
      ...lead,
      ...result.openedDiscrepancies.map((discrepancy): EventDraft => ({
        kind: 'discrepancy.opened',
        message: `${title} dice ${formatValue(printable(discrepancy.value), discrepancy.unit)} en ${factLabel(discrepancy.subject, discrepancy.attribute)} y lo vigente es ${formatValue(printable(discrepancy.baselineValue), discrepancy.unit)}. Le avisamos a ${castName(discrepancy.ownerId)}.`,
        refs: {
          discrepancyId: discrepancy.id,
          castId: discrepancy.ownerId,
        },
      })),
      ...result.backedDiscrepancies.map((discrepancy): EventDraft => ({
        kind: 'discrepancy.backed',
        message: `${title} respaldó lo que decía ${documentDef(discrepancy.documentId)?.name ?? 'otro documento'} sobre ${factLabel(discrepancy.subject, discrepancy.attribute)}.`,
        refs: { discrepancyId: discrepancy.id },
      })),
      ...opened.map((proposal): EventDraft => ({
        kind: 'proposal.opened',
        message: `Nueva propuesta: ${proposal.title}${costSuffix(proposal)}. Avisamos a ${proposal.reviewers.length} de ${LOS_AROMOS.stakeholders.length}.`,
        refs: {
          proposalId: proposal.id,
          castIds: [...proposal.reviewers],
        },
      })),
    ];
    return { value: { ingested: result, proposals: opened }, events };
  }

  private async openProposal(
    db: Db,
    draft: ProposalDraft,
  ): Promise<OpenedProposal> {
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

  private async ingestResponse(
    ingested: IngestedRevision,
    proposals: readonly OpenedProposal[],
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

  receiveMinute(input: { seat: string; minute: RevitMinute }) {
    const { seat, minute } = input;
    const owner = documentOf(REVIT_MODEL_ID).ownerId;
    if (seat !== owner) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_your_document',
        `El modelo de Revit es de ${castName(owner)}`,
      );
    }
    const mapped = mapMinute(minute, seat);
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
    const { ingested, proposals } = await this.uow.run((db) =>
      this.track(db, () => this.ingestMinute(db, seat, minuteId, mapped)),
    );
    const response = await this.ingestResponse(ingested, proposals);
    return {
      minuteId,
      revisionId: response.revisionId,
      documentId: ingested.revision.documentId,
      label: ingested.revision.label,
      title: revisionTitle(ingested.revision),
      claims: response.claims,
      proposals: proposals.map((proposal) => ({
        id: proposal.id,
        changeId: proposal.changeId,
        title: proposal.title,
        costDelta: proposal.costDelta,
        delayDays: proposal.delayDays,
        reviewers: proposal.reviewers.map((id) => ({
          id,
          name: castName(id),
        })),
        filtered: proposal.filtered.map((item) => ({
          stakeholderId: item.stakeholderId,
          name: castName(item.stakeholderId),
          reason: item.reason,
        })),
        link: proposal.changeId ? `/cambios/${proposal.changeId}` : null,
      })),
      discrepancies: response.discrepancies,
      backed: response.backed,
      stale: response.stale,
      ignored: mapped.ignored,
      summary: minuteSummary(ingested, proposals, mapped),
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
      mapped.claims,
      `Ya hay una revisión «${label}» del modelo en el repositorio`,
      (result) => ({
        kind: 'minute.received',
        message: `${castName(seat)} guardó el modelo en Revit (${label}): la minuta trae ${plural(mapped.claims.length, 'cambio', 'cambios')}.`,
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
      proposal: voteProposal(proposal),
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
    const events: EventDraft[] = [];
    if (recorded.changed) {
      const progress = progressOf(recorded.proposal);
      const title = proposalTitle(recorded.proposal);
      if (decision === 'approve') {
        events.push({
          kind: 'review.approved',
          message: `${castName(seat)} aprobó ${title} (${progress.approved} de ${progress.required}).`,
          refs: { proposalId: target.id, castId: seat },
        });
      } else {
        const note = vote.note?.trim();
        events.push({
          kind: 'proposal.disputed',
          message: `${castName(seat)} tiene un problema con ${title}${note ? `: «${note}»` : ''}. Lo vigente no cambia.`,
          refs: { proposalId: target.id, castId: seat },
        });
      }
    }
    return {
      value: { proposalId: target.id, notification: updated ?? found },
      events,
    };
  }

  async reopen(input: { seat: string; proposalId: string }) {
    const seat = input.seat;
    await this.uow.run((db) =>
      this.track(db, async () => {
        const lake = buildLake(db);
        const notifications = buildNotification(db);
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
        const pending = reopenedReviewerIds.map(castName).join(', ');
        return {
          value: undefined,
          events: [
            {
              kind: 'proposal.reopened',
              message: `${castName(seat)} reabrió ${proposalTitle(proposal)} con la observación. Vuelve a responder ${pending || 'nadie'}.`,
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
        await buildLake(db).withdrawProposal.execute({
          proposalId: input.proposalId,
          actorId: seat,
        });
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
    seat: string;
    discrepancyId: string;
    note?: string | null | undefined;
  }): Promise<void> {
    const seat = input.seat;
    await this.uow.run((db) =>
      this.track(db, async () => {
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
                  message: `${castName(seat)} descartó la discrepancia sobre ${factLabel(discrepancy.subject, discrepancy.attribute)}.`,
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
                  message: `${castName(seat)} confirmó sin cambio ${revisionTitle(revision)}.`,
                  refs: { revisionId: revision.id, castId: seat },
                },
              ],
        };
      }),
    );
  }
}
