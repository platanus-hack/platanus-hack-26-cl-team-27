import type { Claim, ClaimValue } from './Claim.ts';
import type { Proposal } from './Proposal.ts';
import { isActive } from './Proposal.ts';

export interface BaselineEntry {
  readonly subject: string;
  readonly attribute: string;
  readonly value: ClaimValue;
  readonly unit: string | null;
  readonly claimId: string | null;
  readonly revisionId: string;
  readonly proposalId: string | null;
  readonly since: Date;
  readonly version: number;
}

export interface BaselineHistoryItem {
  readonly subject: string;
  readonly attribute: string;
  readonly value: ClaimValue;
  readonly unit: string | null;
  readonly claimId: string | null;
  readonly revisionId: string;
  readonly proposalId: string | null;
  readonly since: Date;
  readonly until: Date;
}

export type ValueStatus = 'confirmed' | 'proposed' | 'disputed';

export const baselineKey = (subject: string, attribute: string): string =>
  `${subject}\u0000${attribute}`;

export const touchingProposals = (
  entry: Pick<BaselineEntry, 'subject' | 'attribute'>,
  proposals: readonly Proposal[],
): Proposal[] =>
  proposals.filter(
    (proposal) =>
      isActive(proposal) &&
      proposal.subject === entry.subject &&
      proposal.changes.some((change) => change.attribute === entry.attribute),
  );

export const valueStatus = (
  entry: Pick<BaselineEntry, 'subject' | 'attribute'>,
  proposals: readonly Proposal[],
): ValueStatus => {
  const touching = touchingProposals(entry, proposals);
  if (touching.some((proposal) => proposal.status === 'disputed')) {
    return 'disputed';
  }
  return touching.length > 0 ? 'proposed' : 'confirmed';
};

export const sourcesOf = (
  entry: Pick<BaselineEntry, 'subject' | 'attribute' | 'value'>,
  claims: readonly Claim[],
  currentRevisionIds: ReadonlySet<string>,
): Claim[] =>
  claims.filter(
    (claim) =>
      claim.role === 'afirma' &&
      claim.subject === entry.subject &&
      claim.attribute === entry.attribute &&
      claim.value === entry.value &&
      currentRevisionIds.has(claim.revisionId),
  );
