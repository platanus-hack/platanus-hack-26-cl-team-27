import { randomUUID } from 'node:crypto';

import { HttpStatus } from '@nestjs/common';
import {
  type Axis,
  type Box,
  type Clash,
  type Fix,
  type FlowProposalStatus,
  type SpatialElement,
  canAdvance,
  centerOn,
  detectClashes,
  gapBetween,
  proposeFix,
  translate,
} from '@team27/context-lake';

import {
  AFFECTED_ID,
  CASE_AXIS,
  CASE_ELEMENTS,
  CASE_ID,
  CASE_LEVEL,
  CASE_TITLE,
  CLEARANCE_RULES,
  COST_LINES,
  COST_TOTAL,
  type CaseElement,
  PARTICIPANTS,
  SCHEDULE,
  SEGMENT,
  centimeters,
  clock,
  direction,
  minuteMessage,
  proposalTexts,
  sentText,
} from '../../scenario/caso-p12.ts';
import { fail } from '../coordination/http-errors.ts';
import { castMember, castName } from '../coordination/lookup.ts';
import type { EventDraft } from '../room/events.ts';

export const PRESENCE_TTL_MS = 20_000;

export type Viewing = 'plano' | 'propuesta';

export interface Delta {
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}

export interface MinuteInput {
  readonly minuteId: string;
  readonly source: 'sala' | 'revit';
  readonly model: { readonly title: string; readonly discipline: string };
  readonly changes: readonly {
    readonly elementId: string;
    readonly attribute: 'location';
    readonly delta: Delta;
    readonly reason: string;
  }[];
}

interface ChangeRecord {
  readonly id: string;
  readonly minuteId: string;
  readonly elementId: string;
  readonly delta: Delta;
  readonly reason: string;
  readonly authorId: string;
  readonly at: Date;
  readonly axis: Axis;
  readonly sign: 1 | -1;
  readonly distance: number;
  readonly summary: string;
}

interface ClashRecord {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  readonly penetration: number;
  readonly axis: Axis;
  status: 'detectada' | 'resuelta';
  noAutoFix: boolean;
}

interface ProposalRecord {
  readonly id: string;
  readonly clashId: string;
  readonly elementId: string;
  readonly ownerId: string;
  readonly fix: Fix;
  readonly checks: { label: string; ok: boolean }[];
  readonly texts: ReturnType<typeof proposalTexts>;
  status: FlowProposalStatus;
  decidedBy: string | null;
  decidedAt: Date | null;
  rejectReason: string | null;
  appliedText: string | null;
  resolvedText: string | null;
}

interface PresenceRecord {
  viewing: Viewing | null;
  at: number;
}

export interface FlowStore {
  epoch: number;
  elements: CaseElement[];
  change: ChangeRecord | null;
  clash: ClashRecord | null;
  proposal: ProposalRecord | null;
  presence: Map<string, PresenceRecord>;
}

export interface Outcome {
  readonly events: EventDraft[];
}

export const seedStore = (epoch: number): FlowStore => ({
  epoch,
  elements: CASE_ELEMENTS.map((element) => ({ ...element })),
  change: null,
  clash: null,
  proposal: null,
  presence: new Map(),
});

const toSpatial = (element: CaseElement): SpatialElement => ({
  id: element.id,
  discipline: element.discipline,
  box: element.box,
  support: element.support,
});

const byId = (store: FlowStore, id: string): CaseElement | undefined =>
  store.elements.find((element) => element.id === id);

const replaceBox = (store: FlowStore, id: string, box: Box): void => {
  store.elements = store.elements.map((element) =>
    element.id === id ? { ...element, box } : element,
  );
};

const rules = CLEARANCE_RULES.map((rule) => ({ ...rule }));

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;

const dominant = (
  delta: Delta,
): { axis: Axis; sign: 1 | -1; distance: number } => {
  const entries: [Axis, number][] = [
    ['x', delta.dx],
    ['y', delta.dy],
    ['z', delta.dz],
  ];
  const [axis, value] = entries.reduce((best, item) =>
    Math.abs(item[1]) > Math.abs(best[1]) ? item : best,
  );
  return {
    axis,
    sign: value < 0 ? -1 : 1,
    distance: Math.abs(value),
  };
};

const roleOf = (id: string): string =>
  (castMember(id)?.role ?? '').toLowerCase();

const gapLabel = (id: string, gap: number): string =>
  id === 'P-12' ? `P-12 (${centimeters(gap)} cm)` : id;

const CHECK_LABELS: Readonly<Record<string, string>> = {
  'cielo-n3': 'Cielo falso',
  B2: 'Colector B2',
};

export const submitMinute = (
  store: FlowStore,
  actor: string,
  input: MinuteInput,
  now: Date,
): Outcome | 'replay' => {
  const change = input.changes[0];
  if (!change) {
    throw fail(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'no_changes',
      'La minuta no trae cambios',
    );
  }
  const target = byId(store, change.elementId);
  if (!target) {
    throw fail(
      HttpStatus.NOT_FOUND,
      'not_found',
      `No existe el elemento ${change.elementId}`,
    );
  }
  if (target.ownerId !== actor) {
    throw fail(
      HttpStatus.FORBIDDEN,
      'not_owner',
      `${change.elementId} es de ${castName(target.ownerId)}`,
    );
  }
  if (store.change) {
    if (store.change.minuteId === input.minuteId) return 'replay';
    throw fail(
      HttpStatus.CONFLICT,
      'change_open',
      'Ya hay un cambio abierto en el caso: pide un reinicio',
    );
  }
  const { axis, sign, distance } = dominant(change.delta);
  const before = target.box;
  replaceBox(store, target.id, translate(before, change.delta));
  const moved = byId(store, target.id) as CaseElement;
  const text = {
    authorName: castName(actor),
    elementId: target.id,
    distance,
    axis,
    sign,
  };
  const events: EventDraft[] = [];
  const clashes = detectClashes(
    store.elements.map(toSpatial),
    rules,
    axis,
  ).filter((clash) => clash.a === target.id || clash.b === target.id);
  const affectedElements = clashes
    .map((clash) => byId(store, clash.a === target.id ? clash.b : clash.a))
    .filter((element): element is CaseElement => element !== undefined);
  const affectedOwners = [
    ...new Map(affectedElements.map((e) => [e.ownerId, e])).values(),
  ].map((e) => ({ name: castName(e.ownerId), discipline: e.discipline }));
  store.change = {
    id: randomUUID(),
    minuteId: input.minuteId,
    elementId: target.id,
    delta: change.delta,
    reason: change.reason,
    authorId: actor,
    at: now,
    axis,
    sign,
    distance,
    summary: sentText(text, affectedOwners),
  };
  events.push({
    kind: 'flow.minute.received',
    message: minuteMessage(text),
    refs: { castId: actor, elementId: target.id, minuteId: input.minuteId },
  });
  const first = clashes[0];
  if (!first) return { events };
  const clash: ClashRecord = {
    id: randomUUID(),
    a: first.a,
    b: first.b,
    penetration: first.penetration,
    axis,
    status: 'detectada',
    noAutoFix: false,
  };
  store.clash = clash;
  events.push({
    kind: 'flow.clash.detected',
    message: `Vigente detectó un choque: ${first.a} pisa ${first.b} ${centimeters(first.penetration)} cm.`,
    refs: { clashId: clash.id, a: first.a, b: first.b },
  });
  const victim = affectedElements[0] as CaseElement;
  const fix = victim.movable
    ? proposeFix({
        moving: toSpatial(victim),
        others: store.elements
          .filter((element) => element.id !== victim.id)
          .map(toSpatial),
        rules,
        cause: toSpatial(moved),
        axis,
        sign,
      })
    : null;
  if (!fix) {
    clash.noAutoFix = true;
    events.push({
      kind: 'flow.clash.detected',
      message: `Sin arreglo automático para ${victim.id}: ${castName(victim.ownerId)} tiene que resolverlo.`,
      refs: { clashId: clash.id, castId: victim.ownerId },
    });
    return { events };
  }
  const i = AXIS_INDEX[axis];
  const gapBefore = gapBetween(before, victim.box);
  const checks = fix.checks.map((check) => ({
    label:
      CHECK_LABELS[check.elementId] ?? gapLabel(check.elementId, check.gap),
    ok: check.ok,
  }));
  const proposal: ProposalRecord = {
    id: randomUUID(),
    clashId: clash.id,
    elementId: victim.id,
    ownerId: victim.ownerId,
    fix,
    checks,
    texts: proposalTexts({
      ...text,
      authorRole: roleOf(actor),
      at: now,
      reason: change.reason,
      centerBefore: centerOn(before, axis),
      centerAfter: centerOn(moved.box, axis),
      victimId: victim.id,
      victimSpec: 'escalerilla 300×100 mm',
      victimMin: victim.box.min[i],
      victimMax: victim.box.max[i],
      victimZ: victim.box.min[2],
      gapBefore,
      penetration: first.penetration,
      fixDistance: fix.distance,
      segmentLength: COST_LINES[0]?.quantity ?? 0,
      clearanceAfter: fix.clearanceAfter,
      causeSpec: '40×60 cm, H30',
    }),
    status: 'propuesta',
    decidedBy: null,
    decidedAt: null,
    rejectReason: null,
    appliedText: null,
    resolvedText: null,
  };
  store.proposal = proposal;
  events.push({
    kind: 'flow.fix.proposed',
    message: `Vigente propone correr ${centimeters(fix.distance)} cm ${direction(axis, sign)} el tramo de ${victim.id} de ${castName(victim.ownerId)}.`,
    refs: { proposalId: proposal.id, castId: victim.ownerId },
  });
  return { events };
};

const openProposal = (store: FlowStore, id: string): ProposalRecord => {
  if (!store.proposal || store.proposal.id !== id) {
    throw fail(
      HttpStatus.NOT_FOUND,
      'not_found',
      `No existe la propuesta ${id}`,
    );
  }
  return store.proposal;
};

const requireOwner = (proposal: ProposalRecord, actor: string): void => {
  if (proposal.ownerId !== actor) {
    throw fail(
      HttpStatus.FORBIDDEN,
      'not_owner',
      `Solo ${castName(proposal.ownerId)} decide esta propuesta`,
    );
  }
};

const advance = (proposal: ProposalRecord, to: FlowProposalStatus): void => {
  if (!canAdvance(proposal.status, to)) {
    throw fail(
      HttpStatus.CONFLICT,
      'invalid_state',
      `La propuesta está ${proposal.status}`,
    );
  }
  proposal.status = to;
};

export const acceptProposal = (
  store: FlowStore,
  id: string,
  actor: string,
  now: Date,
): Outcome => {
  const proposal = openProposal(store, id);
  requireOwner(proposal, actor);
  if (
    proposal.status === 'aceptada' ||
    proposal.status === 'aplicada' ||
    proposal.status === 'resuelta'
  ) {
    return { events: [] };
  }
  const name = castName(actor);
  const time = clock(now);
  advance(proposal, 'aceptada');
  proposal.decidedBy = actor;
  proposal.decidedAt = now;
  const events: EventDraft[] = [
    {
      kind: 'flow.fix.accepted',
      message: `${name} aceptó la propuesta de Vigente.`,
      refs: { proposalId: proposal.id, castId: actor },
    },
  ];
  replaceBox(store, proposal.elementId, proposal.fix.box);
  advance(proposal, 'aplicada');
  proposal.appliedText = `Aplicado en tu plano a las ${time}`;
  events.push({
    kind: 'flow.fix.applied',
    message: `Aplicado en el plano de ${name} a las ${time}.`,
    refs: { proposalId: proposal.id, elementId: proposal.elementId },
  });
  const remaining = detectClashes(
    store.elements.map(toSpatial),
    rules,
    store.clash?.axis ?? 'y',
  ).filter((clash) => involves(clash, store.change?.elementId));
  if (remaining.length === 0) {
    advance(proposal, 'resuelta');
    if (store.clash) store.clash.status = 'resuelta';
    proposal.resolvedText = `Resuelto por ${name} a las ${time}`;
    events.push({
      kind: 'flow.resolved',
      message: proposal.resolvedText,
      refs: { proposalId: proposal.id, castId: actor },
    });
  }
  return { events };
};

const involves = (clash: Clash, id: string | undefined): boolean =>
  id !== undefined && (clash.a === id || clash.b === id);

export const rejectProposal = (
  store: FlowStore,
  id: string,
  actor: string,
  reason: string,
  now: Date,
): Outcome => {
  const proposal = openProposal(store, id);
  requireOwner(proposal, actor);
  if (proposal.status === 'rechazada') return { events: [] };
  advance(proposal, 'rechazada');
  proposal.decidedBy = actor;
  proposal.decidedAt = now;
  proposal.rejectReason = reason;
  return {
    events: [
      {
        kind: 'flow.fix.rejected',
        message: `${castName(actor)} tiene un problema con la propuesta: ${reason}`,
        refs: { proposalId: proposal.id, castId: actor },
      },
    ],
  };
};

export const recordPresence = (
  store: FlowStore,
  actor: string,
  viewing: Viewing | null,
  now: number,
): Outcome => {
  const previous = store.presence.get(actor);
  store.presence.set(actor, { viewing, at: now });
  const proposal = store.proposal;
  const fresh =
    previous !== undefined &&
    now - previous.at <= PRESENCE_TTL_MS &&
    previous.viewing === 'propuesta';
  if (
    viewing === 'propuesta' &&
    !fresh &&
    proposal &&
    proposal.status === 'propuesta' &&
    proposal.ownerId === actor
  ) {
    return {
      events: [
        {
          kind: 'flow.presence',
          message: `${castName(actor)} está revisando tu cambio`,
          refs: { castId: actor, proposalId: proposal.id },
        },
      ],
    };
  }
  return { events: [] };
};

export const viewStore = (
  store: FlowStore,
  online: ReadonlySet<string>,
  now: number,
) => {
  const proposal = store.proposal;
  const change = store.change;
  const clash = store.clash;
  return {
    epoch: store.epoch,
    case: {
      id: CASE_ID,
      title: CASE_TITLE,
      level: CASE_LEVEL,
      axis: CASE_AXIS,
      clearanceRules: CLEARANCE_RULES,
    },
    elements: store.elements.map((element) => ({
      id: element.id,
      name: element.name,
      discipline: element.discipline,
      ownerId: element.ownerId,
      ownerName: castName(element.ownerId),
      box: element.box,
      movable: element.movable,
    })),
    change: change && {
      id: change.id,
      minuteId: change.minuteId,
      elementId: change.elementId,
      delta: change.delta,
      reason: change.reason,
      authorId: change.authorId,
      authorName: castName(change.authorId),
      at: change.at.toISOString(),
      summary: change.summary,
      waiting: `Esperando a ${castName(AFFECTED_ID).split(' ')[0]}…`,
    },
    clash: clash && {
      id: clash.id,
      a: clash.a,
      b: clash.b,
      penetration: clash.penetration,
      axis: clash.axis,
      status: clash.status,
      noAutoFix: clash.noAutoFix,
      area: { level: CASE_LEVEL, near: CASE_AXIS },
    },
    proposal: proposal && {
      id: proposal.id,
      clashId: proposal.clashId,
      elementId: proposal.elementId,
      ownerId: proposal.ownerId,
      delta: proposal.fix.delta,
      segment: SEGMENT,
      clearanceAfter: proposal.fix.clearanceAfter,
      checks: proposal.checks,
      cost: {
        lines: COST_LINES,
        total: COST_TOTAL,
        currency: 'CLP',
        vat: false,
      },
      schedule: SCHEDULE,
      texts: proposal.texts,
      status: proposal.status,
      decidedBy: proposal.decidedBy,
      decidedByName: proposal.decidedBy ? castName(proposal.decidedBy) : null,
      decidedAt: proposal.decidedAt?.toISOString() ?? null,
      rejectReason: proposal.rejectReason,
      appliedText: proposal.appliedText,
      resolvedText: proposal.resolvedText,
    },
    presence: PARTICIPANTS.map((castId) => {
      const seen = store.presence.get(castId);
      const live = seen !== undefined && now - seen.at <= PRESENCE_TTL_MS;
      return {
        castId,
        name: castName(castId),
        online: online.has(castId) || live,
        viewing: live ? seen.viewing : null,
      };
    }),
  };
};

export type FlowState = ReturnType<typeof viewStore>;
