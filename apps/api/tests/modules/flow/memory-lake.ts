import {
  type BaselineEntry,
  type BaselineHistoryItem,
  type Chunk,
  type Claim,
  ClearScope,
  EnsureBaseline,
  GetProvenance,
  OpenProposal,
  type Proposal,
  RecordReview,
  RecordRevision,
  type Revision,
} from '@team27/context-lake';

import type { Lake } from '../../../src/modules/flow/flow-lake.ts';

export const memoryLake = (): Lake => {
  const revisions: Revision[] = [];
  const chunks: Chunk[] = [];
  const claims: Claim[] = [];
  const proposals: Proposal[] = [];
  const baseline = new Map<string, BaselineEntry>();
  const history: BaselineHistoryItem[] = [];
  let counter = 0;
  const id = (prefix: string) => `${prefix}-${++counter}`;
  const key = (subject: string, attribute: string) => `${subject}|${attribute}`;
  const drop = <T>(list: T[], gone: (item: T) => boolean) => {
    const kept = list.filter((item) => !gone(item));
    list.length = 0;
    list.push(...kept);
  };

  const repos = {
    revisions: {
      save: (draft: Omit<Revision, 'id' | 'ingestOrder' | 'ingestedAt'>) => {
        const saved: Revision = {
          ...draft,
          id: id('rev'),
          ingestOrder: ++counter,
          ingestedAt: new Date(),
        };
        revisions.push(saved);
        return Promise.resolve(saved);
      },
      findByKey: (documentId: string, label: string) =>
        Promise.resolve(
          revisions.find(
            (r) => r.documentId === documentId && r.label === label,
          ) ?? null,
        ),
      findById: (revisionId: string) =>
        Promise.resolve(revisions.find((r) => r.id === revisionId) ?? null),
      list: () => Promise.resolve([...revisions]),
      deleteByDocuments: (documentIds: readonly string[]) => {
        const gone = new Set(
          revisions
            .filter((r) => documentIds.includes(r.documentId))
            .map((r) => r.id),
        );
        drop(chunks, (c) => gone.has(c.revisionId));
        drop(claims, (c) => gone.has(c.revisionId));
        drop(revisions, (r) => gone.has(r.id));
        return Promise.resolve();
      },
    },
    chunks: {
      saveMany: (
        revisionId: string,
        drafts: readonly Omit<Chunk, 'id' | 'revisionId' | 'position'>[],
      ) => {
        const saved = drafts.map((draft, position): Chunk => ({
          id: id('chunk'),
          revisionId,
          position,
          locator: draft.locator,
          kind: draft.kind,
          text: draft.text,
          rejected: draft.rejected,
        }));
        chunks.push(...saved);
        return Promise.resolve(saved);
      },
      list: () => Promise.resolve([...chunks]),
    },
    claims: {
      saveMany: (
        revisionId: string,
        inserts: readonly Omit<Claim, 'id' | 'revisionId' | 'confidence'>[],
      ) => {
        const saved = inserts.map((insert): Claim => ({
          ...insert,
          id: id('claim'),
          revisionId,
          confidence: null,
        }));
        claims.push(...saved);
        return Promise.resolve(saved);
      },
      list: () => Promise.resolve([...claims]),
    },
    baseline: {
      list: () => Promise.resolve([...baseline.values()]),
      find: (subject: string, attribute: string) =>
        Promise.resolve(baseline.get(key(subject, attribute)) ?? null),
      upsert: (entry: BaselineEntry) => {
        const current = baseline.get(key(entry.subject, entry.attribute));
        if (current) history.push({ ...current, until: entry.since });
        baseline.set(key(entry.subject, entry.attribute), entry);
        return Promise.resolve();
      },
      history: (subject: string, attribute: string) =>
        Promise.resolve(
          history.filter(
            (h) => h.subject === subject && h.attribute === attribute,
          ),
        ),
      deleteBySubjectPrefix: (prefix: string) => {
        for (const [k, entry] of [...baseline]) {
          if (entry.subject.startsWith(prefix)) baseline.delete(k);
        }
        drop(history, (h) => h.subject.startsWith(prefix));
        return Promise.resolve();
      },
    },
    proposals: {
      create: (
        draft: Omit<
          Proposal,
          'id' | 'status' | 'reviews' | 'resolvedAt' | 'supersededById'
        > & { reviewerIds: readonly string[] },
      ) => {
        const saved: Proposal = {
          id: id('proposal'),
          changeId: draft.changeId,
          changeIds: draft.changeIds,
          documentId: draft.documentId,
          sourceRevisionId: draft.sourceRevisionId,
          authorId: draft.authorId,
          changes: draft.changes,
          context: draft.context,
          status: 'open',
          reviews: draft.reviewerIds.map((reviewerId) => ({
            reviewerId,
            decision: null,
            note: null,
            at: null,
          })),
          filtered: draft.filtered,
          openedAt: draft.openedAt,
          resolvedAt: null,
          supersededById: null,
        };
        proposals.push(saved);
        return Promise.resolve(saved);
      },
      save: (next: Proposal) => {
        proposals[proposals.findIndex((p) => p.id === next.id)] = next;
        return Promise.resolve();
      },
      findById: (proposalId: string) =>
        Promise.resolve(proposals.find((p) => p.id === proposalId) ?? null),
      list: () => Promise.resolve([...proposals]),
      listActive: () =>
        Promise.resolve(
          proposals.filter(
            (p) => p.status === 'open' || p.status === 'disputed',
          ),
        ),
      deleteByDocuments: (documentIds: readonly string[]) => {
        drop(proposals, (p) => documentIds.includes(p.documentId));
        return Promise.resolve();
      },
    },
    overlaps: { listLive: () => Promise.resolve([]) },
    discrepancies: { list: () => Promise.resolve([]) },
  };

  const lake = {
    ports: repos,
    getProvenance: new GetProvenance(
      repos.revisions as never,
      repos.claims as never,
      repos.baseline as never,
      repos.proposals as never,
      repos.discrepancies as never,
    ),
    openProposal: new OpenProposal(
      repos.proposals as never,
      repos.baseline as never,
    ),
    recordReview: new RecordReview(
      repos.proposals as never,
      repos.baseline as never,
      repos.overlaps as never,
    ),
    recordRevision: new RecordRevision(
      repos.revisions as never,
      repos.chunks as never,
      repos.claims as never,
    ),
    ensureBaseline: new EnsureBaseline(
      repos.revisions as never,
      repos.chunks as never,
      repos.claims as never,
      repos.baseline as never,
    ),
    clearScope: new ClearScope(
      repos.revisions as never,
      repos.proposals as never,
      repos.baseline as never,
    ),
  };
  return lake as unknown as Lake;
};
