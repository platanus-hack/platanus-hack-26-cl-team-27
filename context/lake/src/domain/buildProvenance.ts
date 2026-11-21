import { sourcesOf, touchingProposals, valueStatus } from './Baseline.ts';
import type {
  BaselineEntry,
  BaselineHistoryItem,
  ValueStatus,
} from './Baseline.ts';
import type { Claim, ClaimValue } from './Claim.ts';
import type { Discrepancy } from './Discrepancy.ts';
import type { Proposal, Review } from './Proposal.ts';
import { latestPerDocument } from './Revision.ts';
import type { Revision } from './Revision.ts';

export interface ProvenanceSource {
  readonly claim: Claim;
  readonly revision: Revision | null;
}

export interface ProvenanceBacking {
  readonly discrepancy: Discrepancy;
  readonly revision: Revision | null;
}

export interface ProvenancePrevious {
  readonly value: ClaimValue;
  readonly unit: string | null;
  readonly since: Date;
  readonly until: Date;
  readonly claim: Claim | null;
  readonly revision: Revision | null;
  readonly proposalId: string | null;
}

export interface Provenance {
  readonly subject: string;
  readonly attribute: string;
  readonly value: ClaimValue;
  readonly unit: string | null;
  readonly since: Date;
  readonly version: number;
  readonly status: ValueStatus;
  readonly claim: Claim | null;
  readonly revision: Revision | null;
  readonly proposal: Proposal | null;
  readonly approvals: readonly Review[];
  readonly sources: readonly ProvenanceSource[];
  readonly backedDiscrepancies: readonly ProvenanceBacking[];
  readonly previous: readonly ProvenancePrevious[];
  readonly openProposalIds: readonly string[];
}

export interface ProvenanceInput {
  readonly entry: BaselineEntry;
  readonly history: readonly BaselineHistoryItem[];
  readonly revisions: readonly Revision[];
  readonly claims: readonly Claim[];
  readonly proposals: readonly Proposal[];
  readonly discrepancies: readonly Discrepancy[];
}

export const buildProvenance = (input: ProvenanceInput): Provenance => {
  const { entry } = input;
  const revisionOf = (id: string): Revision | null =>
    input.revisions.find((revision) => revision.id === id) ?? null;
  const claimOf = (id: string | null): Claim | null =>
    id === null ? null : (input.claims.find((claim) => claim.id === id) ?? null);

  const current = new Set(
    latestPerDocument(input.revisions).map((revision) => revision.id),
  );
  const proposal =
    entry.proposalId === null
      ? null
      : (input.proposals.find((candidate) => candidate.id === entry.proposalId) ??
        null);

  return {
    subject: entry.subject,
    attribute: entry.attribute,
    value: entry.value,
    unit: entry.unit,
    since: entry.since,
    version: entry.version,
    status: valueStatus(entry, input.proposals),
    claim: claimOf(entry.claimId),
    revision: revisionOf(entry.revisionId),
    proposal,
    approvals: (proposal?.reviews ?? []).filter(
      (review) => review.decision === 'approve',
    ),
    sources: sourcesOf(entry, input.claims, current).map((claim) => ({
      claim,
      revision: revisionOf(claim.revisionId),
    })),
    backedDiscrepancies: input.discrepancies
      .filter(
        (discrepancy) =>
          discrepancy.status === 'backed' &&
          discrepancy.subject === entry.subject &&
          discrepancy.attribute === entry.attribute &&
          discrepancy.value === entry.value,
      )
      .map((discrepancy) => ({
        discrepancy,
        revision: revisionOf(discrepancy.revisionId),
      })),
    previous: [...input.history]
      .sort((a, b) => b.until.getTime() - a.until.getTime())
      .map((item) => ({
        value: item.value,
        unit: item.unit,
        since: item.since,
        until: item.until,
        claim: claimOf(item.claimId),
        revision: revisionOf(item.revisionId),
        proposalId: item.proposalId,
      })),
    openProposalIds: touchingProposals(entry, input.proposals).map(
      (candidate) => candidate.id,
    ),
  };
};
