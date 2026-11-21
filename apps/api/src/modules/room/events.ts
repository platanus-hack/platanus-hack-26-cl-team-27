import type { Prisma, PrismaClient } from '@team27/data-main';
import type {
  OverlapStatus,
  Proposal,
  ProposalStatus,
} from '@team27/context-lake';

import { buildLake } from '../lake/lake.module.ts';
import { castName } from '../coordination/lookup.ts';
import { overlapTitle } from '../coordination/views.ts';
import { readState } from './state.ts';

export const EVENT_KINDS = [
  'revision.received',
  'minute.received',
  'proposal.opened',
  'proposal.disputed',
  'proposal.reopened',
  'proposal.merged',
  'proposal.withdrawn',
  'proposal.replaced',
  'review.approved',
  'discrepancy.opened',
  'discrepancy.backed',
  'discrepancy.dismissed',
  'overlap.detected',
  'overlap.voted',
  'overlap.cleared',
  'overlap.confirmed',
  'overlap.resolved',
  'stale.detected',
  'stale.acknowledged',
  'consensus.sealed',
  'seat.claimed',
  'seat.released',
  'lake.seeded',
  'room.reset',
  'flow.minute.received',
  'flow.clash.detected',
  'flow.fix.proposed',
  'flow.presence',
  'flow.fix.accepted',
  'flow.fix.applied',
  'flow.resolved',
  'flow.fix.rejected',
  'flow.reset',
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export type EventRefs = Readonly<Record<string, string | number | string[]>>;

export interface EventDraft {
  readonly kind: EventKind;
  readonly message: string;
  readonly refs?: EventRefs;
}

export const emitEvents = async (
  db: Prisma.TransactionClient,
  events: readonly EventDraft[],
): Promise<void> => {
  if (events.length === 0) return;
  const { epoch } = await readState(db);
  await db.roomEvent.createMany({
    data: events.map((event) => ({
      epoch,
      kind: event.kind,
      message: event.message,
      refs: { ...event.refs },
    })),
  });
};

export interface Observed {
  readonly sealed: boolean;
  readonly version: number;
  readonly proposals: ReadonlyMap<
    string,
    { status: ProposalStatus; title: string }
  >;
  readonly overlaps: ReadonlyMap<
    string,
    { status: OverlapStatus; title: string; validators: readonly string[] }
  >;
  readonly stale: ReadonlyMap<
    string,
    { title: string; ownerId: string; revisionId: string }
  >;
}

export const observe = async (
  db: PrismaClient,
  titleOf: (proposal: Proposal) => string,
): Promise<Observed> => {
  const lake = buildLake(db);
  const [consensus, proposals, overlaps, revisions] = await Promise.all([
    lake.consensus.execute(),
    lake.ports.proposals.list(),
    lake.ports.overlaps.list(),
    lake.ports.revisions.list(),
  ]);
  return {
    sealed: consensus.index.sealed,
    version: 1 + proposals.filter((item) => item.status === 'merged').length,
    proposals: new Map(
      proposals.map((item) => [
        item.id,
        { status: item.status, title: titleOf(item) },
      ]),
    ),
    overlaps: new Map(
      overlaps.map((item) => [
        item.id,
        {
          status: item.status,
          title: overlapTitle(item, revisions),
          validators: item.validators,
        },
      ]),
    ),
    stale: new Map(
      consensus.stale
        .filter((document) => document.acknowledgement === null)
        .map((document) => [
          document.revisionId,
          {
            title: `${document.documentName} ${document.label}`,
            ownerId: document.ownerId,
            revisionId: document.revisionId,
          },
        ]),
    ),
  };
};

export const diffEvents = (before: Observed, after: Observed): EventDraft[] => {
  const events: EventDraft[] = [];
  for (const [id, was] of before.proposals) {
    const now = after.proposals.get(id);
    const wasActive = was.status === 'open' || was.status === 'disputed';
    if (!wasActive || !now) continue;
    if (now.status === 'merged') {
      events.push({
        kind: 'proposal.merged',
        message: `Pasó a lo vigente: ${now.title}. Versión ${after.version} del proyecto.`,
        refs: { proposalId: id },
      });
    } else if (now.status === 'superseded') {
      events.push({
        kind: 'proposal.replaced',
        message: `Una revisión nueva reemplazó la propuesta: ${now.title}.`,
        refs: { proposalId: id },
      });
    } else if (now.status === 'withdrawn') {
      events.push({
        kind: 'proposal.withdrawn',
        message: `Se retiró la propuesta: ${now.title}.`,
        refs: { proposalId: id },
      });
    }
  }
  for (const [id, now] of after.overlaps) {
    const was = before.overlaps.get(id);
    if (!was) {
      events.push({
        kind: 'overlap.detected',
        message: `Solapamiento: ${now.title}. Validan ${now.validators.map(castName).join(' y ')}.`,
        refs: { overlapId: id, castIds: [...now.validators] },
      });
    }
    const wasStatus = was?.status ?? 'abierto';
    if (now.status === wasStatus) continue;
    if (now.status === 'resuelto') {
      events.push({
        kind: 'overlap.resolved',
        message: `Se resolvió el solapamiento: ${now.title}. Los elementos ya no comparten área.`,
        refs: { overlapId: id },
      });
    } else if (now.status === 'confirmado') {
      events.push({
        kind: 'overlap.confirmed',
        message: `Se confirmó el solapamiento: ${now.title}. Es un conflicto real.`,
        refs: { overlapId: id, castIds: [...now.validators] },
      });
    } else if (now.status === 'descartado') {
      events.push({
        kind: 'overlap.cleared',
        message: `Se descartó el solapamiento: ${now.title}. Todos dijeron que no se tocan.`,
        refs: { overlapId: id },
      });
    }
  }
  for (const [revisionId, stale] of after.stale) {
    if (before.stale.has(revisionId)) continue;
    events.push({
      kind: 'stale.detected',
      message: `Quedó desfasado: ${stale.title}. Le toca a ${castName(stale.ownerId)}.`,
      refs: { revisionId, castId: stale.ownerId },
    });
  }
  if (after.sealed && !before.sealed) {
    events.push({
      kind: 'consensus.sealed',
      message: `Obra consensuada: versión ${after.version} del proyecto.`,
      refs: { version: after.version },
    });
  }
  return events;
};
