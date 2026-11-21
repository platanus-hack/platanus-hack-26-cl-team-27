import type { Prisma, PrismaClient } from '@team27/data-main';
import type { Proposal, ProposalStatus } from '@team27/context-lake';

import { buildLake } from '../lake/lake.module.ts';
import { castName } from '../coordination/lookup.ts';
import { readState } from './state.ts';

export const EVENT_KINDS = [
  'document.dropped',
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
  'stale.detected',
  'stale.acknowledged',
  'consensus.sealed',
  'seat.claimed',
  'seat.released',
  'scene.started',
  'autoplay.changed',
  'room.reset',
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
  const [consensus, proposals] = await Promise.all([
    lake.consensus.execute(),
    lake.ports.proposals.list(),
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
  for (const [revisionId, stale] of after.stale) {
    if (before.stale.has(revisionId)) continue;
    events.push({
      kind: 'stale.detected',
      message: `${stale.title} quedó desfasado. Le toca a ${castName(stale.ownerId)}.`,
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
