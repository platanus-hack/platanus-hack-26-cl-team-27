import type { AcknowledgementRepository } from '../src/application/ports/AcknowledgementRepository.ts';
import type { BaselineRepository } from '../src/application/ports/BaselineRepository.ts';
import type { ClaimRepository } from '../src/application/ports/ClaimRepository.ts';
import type { DiscrepancyRepository } from '../src/application/ports/DiscrepancyRepository.ts';
import type { FactExtractor } from '../src/application/ports/FactExtractor.ts';
import type { ProposalRepository } from '../src/application/ports/ProposalRepository.ts';
import type { RevisionRepository } from '../src/application/ports/RevisionRepository.ts';
import type { Acknowledgement } from '../src/domain/Acknowledgement.ts';
import type {
  BaselineEntry,
  BaselineHistoryItem,
} from '../src/domain/Baseline.ts';
import type { Claim, ClaimDraft } from '../src/domain/Claim.ts';
import type { Discrepancy } from '../src/domain/Discrepancy.ts';
import type { Proposal } from '../src/domain/Proposal.ts';
import type { Revision } from '../src/domain/Revision.ts';

export const fakeLake = (catalog: Record<string, ClaimDraft[]> = {}) => {
  const revisions: Revision[] = [];
  const claims: Claim[] = [];
  const baseline = new Map<string, BaselineEntry>();
  const history: BaselineHistoryItem[] = [];
  const proposals: Proposal[] = [];
  const discrepancies: Discrepancy[] = [];
  const acknowledgements: Acknowledgement[] = [];
  let counter = 0;
  const nextId = (prefix: string) => `${prefix}-${++counter}`;
  const key = (subject: string, attribute: string) => `${subject}.${attribute}`;

  const revisionRepo = {
    save: vi.fn<RevisionRepository['save']>((draft) => {
      const saved: Revision = {
        ...draft,
        id: nextId('rev'),
        ingestOrder: revisions.length + 1,
        ingestedAt: new Date(),
      };
      revisions.push(saved);
      return Promise.resolve(saved);
    }),
    findByKey: vi.fn<RevisionRepository['findByKey']>((documentId, label) =>
      Promise.resolve(
        revisions.find(
          (r) => r.documentId === documentId && r.label === label,
        ) ?? null,
      ),
    ),
    findById: vi.fn<RevisionRepository['findById']>((id) =>
      Promise.resolve(revisions.find((r) => r.id === id) ?? null),
    ),
    list: vi.fn<RevisionRepository['list']>(() =>
      Promise.resolve([...revisions]),
    ),
    clear: vi.fn<RevisionRepository['clear']>(() => {
      revisions.length = 0;
      return Promise.resolve();
    }),
  } satisfies RevisionRepository;

  const claimRepo = {
    saveMany: vi.fn<ClaimRepository['saveMany']>((revisionId, drafts) => {
      const saved = drafts.map((draft) => ({
        ...draft,
        id: nextId('claim'),
        revisionId,
      }));
      claims.push(...saved);
      return Promise.resolve(saved);
    }),
    list: vi.fn<ClaimRepository['list']>(() => Promise.resolve([...claims])),
    listFor: vi.fn<ClaimRepository['listFor']>((subject, attribute) =>
      Promise.resolve(
        claims.filter(
          (c) => c.subject === subject && c.attribute === attribute,
        ),
      ),
    ),
    clear: vi.fn<ClaimRepository['clear']>(() => {
      claims.length = 0;
      return Promise.resolve();
    }),
  } satisfies ClaimRepository;

  const baselineRepo = {
    list: vi.fn<BaselineRepository['list']>(() =>
      Promise.resolve([...baseline.values()]),
    ),
    find: vi.fn<BaselineRepository['find']>((subject, attribute) =>
      Promise.resolve(baseline.get(key(subject, attribute)) ?? null),
    ),
    upsert: vi.fn<BaselineRepository['upsert']>((next) => {
      const current = baseline.get(key(next.subject, next.attribute));
      if (current) history.push({ ...current, until: next.since });
      baseline.set(key(next.subject, next.attribute), next);
      return Promise.resolve();
    }),
    history: vi.fn<BaselineRepository['history']>((subject, attribute) =>
      Promise.resolve(
        history.filter(
          (h) => h.subject === subject && h.attribute === attribute,
        ),
      ),
    ),
    clear: vi.fn<BaselineRepository['clear']>(() => {
      baseline.clear();
      history.length = 0;
      return Promise.resolve();
    }),
  } satisfies BaselineRepository;

  const proposalRepo = {
    create: vi.fn<ProposalRepository['create']>((draft) => {
      const saved: Proposal = {
        id: nextId('proposal'),
        changeId: draft.changeId,
        subject: draft.subject,
        sourceRevisionId: draft.sourceRevisionId,
        authorId: draft.authorId,
        changes: draft.changes,
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
    }),
    save: vi.fn<ProposalRepository['save']>((next) => {
      const index = proposals.findIndex((p) => p.id === next.id);
      proposals[index] = next;
      return Promise.resolve();
    }),
    findById: vi.fn<ProposalRepository['findById']>((id) =>
      Promise.resolve(proposals.find((p) => p.id === id) ?? null),
    ),
    list: vi.fn<ProposalRepository['list']>((status) =>
      Promise.resolve(
        proposals.filter((p) => status === undefined || p.status === status),
      ),
    ),
    listActive: vi.fn<ProposalRepository['listActive']>(() =>
      Promise.resolve(
        proposals.filter((p) => p.status === 'open' || p.status === 'disputed'),
      ),
    ),
    clear: vi.fn<ProposalRepository['clear']>(() => {
      proposals.length = 0;
      return Promise.resolve();
    }),
  } satisfies ProposalRepository;

  const discrepancyRepo = {
    create: vi.fn<DiscrepancyRepository['create']>((draft) => {
      const saved: Discrepancy = {
        ...draft,
        id: nextId('discrepancy'),
        status: 'open',
        backedByRevisionId: null,
        note: null,
        createdAt: new Date(),
        resolvedAt: null,
      };
      discrepancies.push(saved);
      return Promise.resolve(saved);
    }),
    resolve: vi.fn<DiscrepancyRepository['resolve']>((id, resolution) => {
      const index = discrepancies.findIndex((d) => d.id === id);
      const next: Discrepancy = { ...discrepancies[index]!, ...resolution };
      discrepancies[index] = next;
      return Promise.resolve(next);
    }),
    findById: vi.fn<DiscrepancyRepository['findById']>((id) =>
      Promise.resolve(discrepancies.find((d) => d.id === id) ?? null),
    ),
    list: vi.fn<DiscrepancyRepository['list']>(() =>
      Promise.resolve([...discrepancies]),
    ),
    listOpen: vi.fn<DiscrepancyRepository['listOpen']>(() =>
      Promise.resolve(discrepancies.filter((d) => d.status === 'open')),
    ),
    clear: vi.fn<DiscrepancyRepository['clear']>(() => {
      discrepancies.length = 0;
      return Promise.resolve();
    }),
  } satisfies DiscrepancyRepository;

  const acknowledgementRepo = {
    create: vi.fn<AcknowledgementRepository['create']>((draft) => {
      const saved: Acknowledgement = {
        ...draft,
        id: nextId('ack'),
        at: new Date(),
      };
      acknowledgements.push(saved);
      return Promise.resolve(saved);
    }),
    list: vi.fn<AcknowledgementRepository['list']>(() =>
      Promise.resolve([...acknowledgements]),
    ),
    clear: vi.fn<AcknowledgementRepository['clear']>(() => {
      acknowledgements.length = 0;
      return Promise.resolve();
    }),
  } satisfies AcknowledgementRepository;

  const extractor = {
    extract: vi.fn<FactExtractor['extract']>((draft) =>
      Promise.resolve(catalog[`${draft.documentId}@${draft.label}`] ?? []),
    ),
  } satisfies FactExtractor;

  return {
    revisions: revisionRepo,
    claims: claimRepo,
    baseline: baselineRepo,
    proposals: proposalRepo,
    discrepancies: discrepancyRepo,
    acknowledgements: acknowledgementRepo,
    extractor,
  };
};

export type FakeLake = ReturnType<typeof fakeLake>;
