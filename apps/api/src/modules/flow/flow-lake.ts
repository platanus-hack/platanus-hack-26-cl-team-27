import { createHash } from 'node:crypto';

import {
  type Axis,
  type Box,
  type ChunkDraft,
  type Fix,
  type Proposal,
  type ProposalChange,
  type Revision,
  type RevisionDraft,
  type SeedLakeInput,
  decodeBox,
  encodeBox,
  roundBox,
} from '@team27/context-lake';

import {
  BASE_LABEL,
  CASE_ATTRIBUTE,
  CASE_DOCUMENTS,
  CASE_DOCUMENT_IDS,
  CASE_ELEMENTS,
  CASE_SPACE,
  CASE_SUBJECT_PREFIX,
  CASE_UNIT,
  FIX_LABEL_PREFIX,
  VIGENTE_ID,
  caseElementId,
  caseSubject,
  clock,
  documentOfElement,
  proposalTexts,
} from '../../scenario/caso-p12.ts';
import type { buildLake } from '../lake/lake.module.ts';
import {
  type CastNames,
  type ChangeRecord,
  type ClashRecord,
  type Delta,
  type FlowStore,
  type MinuteInput,
  type ProposalRecord,
  dominant,
  hasRemainingClash,
  seedStore,
} from './flow-engine.ts';

export type Lake = ReturnType<typeof buildLake>;

export interface MinutePayload {
  readonly source: 'sala' | 'revit';
  readonly model: { readonly title: string; readonly discipline: string };
  readonly elementId: string;
  readonly delta: Delta;
  readonly reason: string;
  readonly summary: string;
  readonly clash: {
    readonly a: string;
    readonly b: string;
    readonly penetration: number;
    readonly axis: Axis;
    readonly noAutoFix: boolean;
  } | null;
}

export interface FixPayload {
  readonly victimId: string;
  readonly ownerId: string;
  readonly fix: Fix;
  readonly checks: { label: string; ok: boolean }[];
  readonly texts: ReturnType<typeof proposalTexts>;
}

export const caseSeed = (): SeedLakeInput => ({
  revisions: CASE_DOCUMENTS.map((document) => {
    const element = CASE_ELEMENTS.find(
      (candidate) => candidate.id === document.elementId,
    );
    if (!element) throw new Error(`Falta el elemento ${document.elementId}`);
    const locator = `elemento ${element.id}`;
    return {
      revision: {
        documentId: document.id,
        documentName: document.name,
        label: BASE_LABEL,
        kind: 'plano',
        spaceId: CASE_SPACE,
        authorId: element.ownerId,
        contentHash: `base-${document.id}`,
        sourcePointer: `semilla:${document.id}`,
      },
      chunks: [
        {
          locator,
          kind: 'parametro',
          text: null,
          claims: [
            {
              subject: caseSubject(element.id),
              attribute: CASE_ATTRIBUTE,
              value: encodeBox(element.box),
              unit: CASE_UNIT,
              role: 'afirma',
              locator,
            },
          ],
          rejected: [],
        },
      ],
    };
  }),
});

export const seedCase = async (lake: Lake): Promise<void> => {
  await lake.ensureBaseline.execute(caseSeed());
};

export const clearCase = async (lake: Lake): Promise<void> => {
  await lake.clearScope.execute({
    documentIds: CASE_DOCUMENT_IDS,
    subjectPrefix: CASE_SUBJECT_PREFIX,
  });
  await seedCase(lake);
};

const parse = <T>(text: string | null | undefined): T | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export const caseRevisions = (
  revisions: readonly Revision[],
): { minute: Revision | null; fix: Revision | null } => {
  const mine = revisions
    .filter(
      (revision) =>
        CASE_DOCUMENT_IDS.includes(revision.documentId) &&
        revision.label !== BASE_LABEL,
    )
    .sort((a, b) => a.ingestOrder - b.ingestOrder);
  return {
    minute: mine.find((revision) => revision.authorId !== VIGENTE_ID) ?? null,
    fix: mine.find((revision) => revision.authorId === VIGENTE_ID) ?? null,
  };
};

const boxesFrom = (
  entries: readonly { subject: string; attribute: string; value: unknown }[],
): Map<string, Box> => {
  const boxes = new Map<string, Box>();
  for (const entry of entries) {
    if (
      entry.attribute !== CASE_ATTRIBUTE ||
      !entry.subject.startsWith(CASE_SUBJECT_PREFIX) ||
      typeof entry.value !== 'string'
    ) {
      continue;
    }
    const box = decodeBox(entry.value);
    if (box) boxes.set(caseElementId(entry.subject), box);
  }
  return boxes;
};

const afterOf = (proposal: Proposal, subject: string): string | null => {
  const hunk = proposal.changes.find((change) => change.subject === subject);
  return typeof hunk?.after === 'string' ? hunk.after : null;
};

const isActive = (proposal: Proposal): boolean =>
  proposal.status === 'open' || proposal.status === 'disputed';

export const loadStore = async (
  lake: Lake,
  epoch: number,
  cast: CastNames,
  presence: FlowStore['presence'],
): Promise<FlowStore> => {
  const store = seedStore(epoch, cast);
  store.presence = presence;
  const entries = await lake.ports.baseline.list();
  const boxes = boxesFrom(entries);
  store.elements = CASE_ELEMENTS.map((element) => ({
    ...element,
    box: boxes.get(element.id) ?? element.box,
  }));
  const revisions = await lake.ports.revisions.list();
  const { minute, fix } = caseRevisions(revisions);
  if (!minute) return store;
  const chunks = await lake.ports.chunks.list();
  const textOf = (revisionId: string) =>
    chunks.find((chunk) => chunk.revisionId === revisionId)?.text;
  const payload = parse<MinutePayload>(textOf(minute.id));
  if (!payload) return store;
  const { axis, sign, distance } = dominant(payload.delta);
  const change: ChangeRecord = {
    id: minute.id,
    minuteId: minute.label,
    elementId: payload.elementId,
    delta: payload.delta,
    reason: payload.reason,
    authorId: minute.authorId,
    at: minute.ingestedAt,
    axis,
    sign,
    distance,
    summary: payload.summary,
  };
  store.change = change;
  const proposals = (await lake.ports.proposals.list()).filter(
    (candidate) => candidate.sourceRevisionId === minute.id,
  );
  const lakeProposal = proposals[proposals.length - 1] ?? null;
  const target = caseSubject(payload.elementId);
  if (lakeProposal && isActive(lakeProposal)) {
    const overlay = afterOf(lakeProposal, target);
    const box = overlay ? decodeBox(overlay) : null;
    if (box) {
      store.elements = store.elements.map((element) =>
        element.id === payload.elementId ? { ...element, box } : element,
      );
    }
  }
  if (!payload.clash) return store;
  const clash: ClashRecord = {
    id: `${minute.id}:clash`,
    a: payload.clash.a,
    b: payload.clash.b,
    penetration: payload.clash.penetration,
    axis: payload.clash.axis,
    status: 'detectada',
    noAutoFix: payload.clash.noAutoFix,
  };
  store.clash = clash;
  const fixPayload = fix ? parse<FixPayload>(textOf(fix.id)) : null;
  if (!lakeProposal || !fixPayload) return store;
  const review = lakeProposal.reviews.find(
    (candidate) => candidate.decision !== null,
  );
  const decidedAt = review?.at ?? null;
  const decidedBy = review?.reviewerId ?? null;
  const record: ProposalRecord = {
    id: lakeProposal.id,
    clashId: clash.id,
    elementId: fixPayload.victimId,
    ownerId: fixPayload.ownerId,
    fix: fixPayload.fix,
    checks: fixPayload.checks,
    texts: fixPayload.texts,
    status: 'propuesta',
    decidedBy,
    decidedAt,
    rejectReason: null,
    appliedText: null,
    resolvedText: null,
  };
  if (lakeProposal.status === 'disputed') {
    record.status = 'rechazada';
    record.rejectReason = review?.note ?? null;
  } else if (lakeProposal.status === 'merged' && decidedAt && decidedBy) {
    const time = clock(decidedAt);
    const clean = !hasRemainingClash(store);
    record.status = clean ? 'resuelta' : 'aplicada';
    record.appliedText = `Aplicado en tu plano a las ${time}`;
    if (clean) {
      clash.status = 'resuelta';
      record.resolvedText = `Resuelto por ${cast.castName(decidedBy)} a las ${time}`;
    }
  }
  store.proposal = record;
  return store;
};

const sha = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const hunk = (
  element: { id: string },
  before: string,
  after: string,
  claimId: string | null,
  revisionId: string,
): ProposalChange => ({
  subject: caseSubject(element.id),
  attribute: CASE_ATTRIBUTE,
  unit: CASE_UNIT,
  before,
  after,
  claimId,
  locator: `elemento ${element.id}`,
  revisionId,
});

const chunkOf = (
  elementId: string,
  kind: ChunkDraft['kind'],
  payload: unknown,
  value: string,
): ChunkDraft => {
  const locator = `elemento ${elementId}`;
  return {
    locator,
    kind,
    text: JSON.stringify(payload),
    claims: [
      {
        subject: caseSubject(elementId),
        attribute: CASE_ATTRIBUTE,
        value,
        unit: CASE_UNIT,
        role: 'afirma',
        locator,
      },
    ],
    rejected: [],
  };
};

const draftOf = (
  documentId: string,
  label: string,
  authorId: string,
  pointer: string,
  hash: string,
): RevisionDraft => {
  const document = CASE_DOCUMENTS.find(
    (candidate) => candidate.id === documentId,
  );
  return {
    documentId,
    documentName: document?.name ?? documentId,
    label,
    kind: 'plano',
    spaceId: CASE_SPACE,
    authorId,
    contentHash: hash,
    sourcePointer: pointer,
  };
};

export const persistMinute = async (
  lake: Lake,
  store: FlowStore,
  input: MinuteInput,
): Promise<void> => {
  const change = store.change as ChangeRecord;
  const document = documentOfElement(change.elementId);
  if (!document) throw new Error(`Sin documento para ${change.elementId}`);
  const byId = (id: string) =>
    store.elements.find((element) => element.id === id);
  const target = byId(change.elementId);
  if (!target) throw new Error(`Sin elemento ${change.elementId}`);
  const baseline = async (id: string): Promise<string> => {
    const entry = await lake.ports.baseline.find(
      caseSubject(id),
      CASE_ATTRIBUTE,
    );
    return String(entry?.value ?? '');
  };
  const clash = store.clash;
  const payload: MinutePayload = {
    source: input.source,
    model: input.model,
    elementId: change.elementId,
    delta: change.delta,
    reason: change.reason,
    summary: change.summary,
    clash: clash && {
      a: clash.a,
      b: clash.b,
      penetration: clash.penetration,
      axis: clash.axis,
      noAutoFix: clash.noAutoFix,
    },
  };
  const afterText = encodeBox(roundBox(target.box));
  const beforeText = await baseline(target.id);
  const minute = await lake.recordRevision.execute({
    revision: draftOf(
      document.id,
      change.minuteId,
      change.authorId,
      `${input.source}:${change.minuteId}`,
      sha(input),
    ),
    chunks: [chunkOf(target.id, 'anotacion', payload, afterText)],
  });
  const changes: ProposalChange[] = [
    hunk(
      target,
      beforeText,
      afterText,
      minute.claims[0]?.id ?? null,
      minute.revision.id,
    ),
  ];
  const proposal = store.proposal;
  if (proposal) {
    const victim = byId(proposal.elementId);
    const victimDocument = documentOfElement(proposal.elementId);
    if (!victim || !victimDocument) {
      throw new Error(`Sin elemento ${proposal.elementId}`);
    }
    const fixPayload: FixPayload = {
      victimId: victim.id,
      ownerId: proposal.ownerId,
      fix: proposal.fix,
      checks: proposal.checks,
      texts: proposal.texts,
    };
    const fixText = encodeBox(roundBox(proposal.fix.box));
    const fixed = await lake.recordRevision.execute({
      revision: draftOf(
        victimDocument.id,
        `${FIX_LABEL_PREFIX}${change.minuteId}`,
        VIGENTE_ID,
        `vigente:${change.minuteId}`,
        sha(fixPayload),
      ),
      chunks: [chunkOf(victim.id, 'texto', fixPayload, fixText)],
    });
    changes.push(
      hunk(
        victim,
        await baseline(victim.id),
        fixText,
        fixed.claims[0]?.id ?? null,
        fixed.revision.id,
      ),
    );
  }
  const reviewerIds = clash
    ? [byId(clash.a === target.id ? clash.b : clash.a)?.ownerId].filter(
        (id): id is string => id !== undefined,
      )
    : [];
  await lake.openProposal.execute({
    draft: {
      documentId: document.id,
      sourceRevisionId: minute.revision.id,
      authorId: change.authorId,
      changes,
      context: [],
      before: Object.fromEntries(
        changes.map((item) => [
          item.subject,
          { [item.attribute]: item.before },
        ]),
      ),
      after: Object.fromEntries(
        changes.map((item) => [item.subject, { [item.attribute]: item.after }]),
      ),
    },
    changeId: null,
    reviewerIds,
    filtered: [],
  });
};

export const persistDecision = async (
  lake: Lake,
  kind: 'accept' | 'reject',
  proposalId: string,
  actor: string,
  reason?: string,
): Promise<void> => {
  await lake.recordReview.execute({
    proposalId,
    reviewerId: actor,
    decision: kind === 'accept' ? 'approve' : 'dispute',
    note: reason ?? null,
  });
};
