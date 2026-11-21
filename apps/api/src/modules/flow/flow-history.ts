import type {
  Provenance,
  Proposal,
  Review,
  Revision,
} from '@team27/context-lake';

import {
  BASE_LABEL,
  CASE_ATTRIBUTE,
  CASE_ELEMENTS,
  FIX_LABEL_PREFIX,
  VIGENTE_ID,
  VIGENTE_NAME,
  caseSubject,
  centimeters,
  clock,
  direction,
} from '../../scenario/caso-p12.ts';
import { type CastNames, dominant } from './flow-engine.ts';
import type { FixPayload, MinutePayload } from './flow-lake.ts';

export interface HistoryInput {
  readonly epoch: number;
  readonly cast: CastNames;
  readonly provenances: ReadonlyMap<string, Provenance | null>;
  readonly proposals: readonly Proposal[];
  readonly revisions: readonly Revision[];
  readonly texts: ReadonlyMap<string, string | null>;
}

type Person = { id: string; name: string };

type Kind = 'base' | 'minuta' | 'arreglo';

const parse = <T>(text: string | null | undefined): T | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const kindOf = (revision: Revision): Kind => {
  if (revision.label === BASE_LABEL) return 'base';
  return revision.authorId === VIGENTE_ID ? 'arreglo' : 'minuta';
};

export const approvalText = (name: string, at: Date): string =>
  `Aprobó ${name} a las ${clock(at)}`;

const who = (cast: CastNames, id: string): Person => ({
  id,
  name: id === VIGENTE_ID ? VIGENTE_NAME : cast.castName(id),
});

const short = (label: string): string =>
  label.length > 12 ? label.slice(0, 8) : label;

const entryText = (
  input: HistoryInput,
  kind: Kind,
  revision: Revision,
  elementId: string,
  approvals: readonly Review[],
): string => {
  const author = who(input.cast, revision.authorId).name;
  if (kind === 'base')
    return `Valor inicial del modelo ${revision.documentName}`;
  const text = input.texts.get(revision.id) ?? null;
  if (kind === 'minuta') {
    const payload = parse<MinutePayload>(text);
    if (!payload)
      return `${author} cambió ${elementId} (minuta ${short(revision.label)})`;
    const { axis, sign, distance } = dominant(payload.delta);
    return `${author} movió ${elementId} ${centimeters(distance)} cm ${direction(axis, sign)} (minuta ${short(revision.label)} de ${revision.documentName})`;
  }
  const payload = parse<FixPayload>(text);
  const head = payload
    ? (() => {
        const { axis, sign, distance } = dominant(payload.fix.delta);
        return `${VIGENTE_NAME} propuso correr ${centimeters(distance)} cm ${direction(axis, sign)} el tramo de ${elementId}`;
      })()
    : `${VIGENTE_NAME} propuso un arreglo para ${elementId}`;
  const approved = approvals.find((review) => review.at !== null);
  return approved?.at
    ? `${head}; ${who(input.cast, approved.reviewerId).name} lo aprobó a las ${clock(approved.at)}`
    : head;
};

const detail = (input: HistoryInput, revision: Revision, kind: Kind) => {
  const payload =
    kind === 'minuta'
      ? parse<MinutePayload>(input.texts.get(revision.id) ?? null)
      : null;
  const minuteId =
    kind === 'minuta'
      ? revision.label
      : kind === 'arreglo'
        ? revision.label.slice(FIX_LABEL_PREFIX.length)
        : null;
  return {
    source: payload?.source ?? null,
    minuteId,
    reason: payload?.reason ?? null,
  };
};

const buildEntry = (
  input: HistoryInput,
  elementId: string,
  item: {
    current: boolean;
    value: string;
    unit: string | null;
    at: Date;
    until: Date | null;
    revision: Revision;
    proposalId: string | null;
  },
) => {
  const kind = kindOf(item.revision);
  const proposal = item.proposalId
    ? (input.proposals.find((candidate) => candidate.id === item.proposalId) ??
      null)
    : null;
  const approvals = (proposal?.reviews ?? []).filter(
    (review) => review.decision === 'approve' && review.at !== null,
  );
  return {
    current: item.current,
    kind,
    value: item.value,
    unit: item.unit,
    at: item.at.toISOString(),
    ...(item.until ? { until: item.until.toISOString() } : {}),
    by: who(input.cast, item.revision.authorId),
    document: `${item.revision.documentName} ${item.revision.label}`,
    ...detail(input, item.revision, kind),
    text: entryText(input, kind, item.revision, elementId, approvals),
    approvedBy: approvals.map((review) => ({
      ...who(input.cast, review.reviewerId),
      at: (review.at as Date).toISOString(),
    })),
    proposalId: item.proposalId,
  };
};

const pendingOf = (input: HistoryInput, subject: string) => {
  const proposal = input.proposals.find(
    (candidate) =>
      (candidate.status === 'open' || candidate.status === 'disputed') &&
      candidate.changes.some((change) => change.subject === subject),
  );
  const hunk = proposal?.changes.find((change) => change.subject === subject);
  if (!proposal || !hunk) return null;
  const revision = hunk.revisionId
    ? (input.revisions.find((candidate) => candidate.id === hunk.revisionId) ??
      null)
    : null;
  const disputed = proposal.reviews.find(
    (review) => review.decision === 'dispute',
  );
  const awaiting = proposal.reviews
    .filter((review) => review.decision === null)
    .map((review) => who(input.cast, review.reviewerId));
  const owners = proposal.reviews.map(
    (review) => who(input.cast, review.reviewerId).name,
  );
  return {
    value: String(hunk.after),
    by: who(input.cast, revision?.authorId ?? proposal.authorId),
    at: proposal.openedAt.toISOString(),
    status: disputed ? ('rechazada' as const) : ('propuesta' as const),
    awaiting,
    reason: disputed?.note ?? null,
    text: disputed
      ? `Rechazada por ${who(input.cast, disputed.reviewerId).name}${disputed.note ? `: ${disputed.note}` : ''}`
      : `Pendiente de ${owners.join(' y ')}`,
  };
};

export const buildHistory = (input: HistoryInput) => ({
  epoch: input.epoch,
  elements: CASE_ELEMENTS.filter(
    (element) => element.id === 'P-12' || element.id === 'E-B-03',
  ).map((element) => {
    const subject = caseSubject(element.id);
    const provenance = input.provenances.get(subject) ?? null;
    const entries = [];
    if (provenance?.revision) {
      entries.push(
        buildEntry(input, element.id, {
          current: true,
          value: String(provenance.value),
          unit: provenance.unit,
          at: provenance.since,
          until: null,
          revision: provenance.revision,
          proposalId: provenance.proposal?.id ?? null,
        }),
      );
      for (const previous of provenance.previous) {
        if (!previous.revision) continue;
        entries.push(
          buildEntry(input, element.id, {
            current: false,
            value: String(previous.value),
            unit: previous.unit,
            at: previous.since,
            until: previous.until,
            revision: previous.revision,
            proposalId: previous.proposalId,
          }),
        );
      }
    }
    return {
      elementId: element.id,
      subjectId: subject,
      attribute: CASE_ATTRIBUTE,
      name: element.name,
      link: `/valor/${subject}/${CASE_ATTRIBUTE}`,
      pending: pendingOf(input, subject),
      entries,
    };
  }),
});

export type FlowHistory = ReturnType<typeof buildHistory>;
