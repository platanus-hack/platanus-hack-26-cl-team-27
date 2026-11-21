import type { Discrepancy } from './Discrepancy.ts';
import type { Proposal } from './Proposal.ts';
import { isActive } from './Proposal.ts';
import type { StaleDocument } from './computeStaleness.ts';
import { latestPerDocument } from './Revision.ts';
import type { Revision } from './Revision.ts';

export interface ConsensusIndex {
  readonly upToDate: number;
  readonly total: number;
  readonly openProposals: number;
  readonly openDiscrepancies: number;
  readonly staleDocuments: number;
  readonly acknowledgedDocuments: number;
  readonly sealed: boolean;
}

export interface ConsensusInput {
  readonly revisions: readonly Revision[];
  readonly stale: readonly StaleDocument[];
  readonly discrepancies: readonly Discrepancy[];
  readonly proposals: readonly Proposal[];
}

export const consensusIndex = (input: ConsensusInput): ConsensusIndex => {
  const documents = latestPerDocument(input.revisions);
  const open = input.discrepancies.filter(
    (discrepancy) => discrepancy.status === 'open',
  );
  const pending = new Set<string>(
    input.stale
      .filter((document) => document.acknowledgement === null)
      .map((document) => document.documentId),
  );
  for (const discrepancy of open) pending.add(discrepancy.documentId);

  const openProposals = input.proposals.filter(isActive).length;
  const upToDate = documents.filter(
    (document) => !pending.has(document.documentId),
  ).length;
  const staleDocuments = input.stale.filter(
    (document) => document.acknowledgement === null,
  ).length;
  return {
    upToDate,
    total: documents.length,
    openProposals,
    openDiscrepancies: open.length,
    staleDocuments,
    acknowledgedDocuments: input.stale.length - staleDocuments,
    sealed:
      openProposals === 0 && open.length === 0 && staleDocuments === 0,
  };
};
