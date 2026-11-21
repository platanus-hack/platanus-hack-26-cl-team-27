import { hasAuthority } from './Authority.ts';
import type { AuthorityTable } from './Authority.ts';
import { baselineKey } from './Baseline.ts';
import type { BaselineEntry } from './Baseline.ts';
import type { Claim } from './Claim.ts';
import type { Discrepancy } from './Discrepancy.ts';
import type { DocumentKind } from './DocumentKind.ts';
import { isActive } from './Proposal.ts';
import type { Proposal } from './Proposal.ts';

export type ClaimOutcomeKind =
  | 'same'
  | 'corroborates'
  | 'change'
  | 'discrepancy'
  | 'unknown'
  | 'uses_current'
  | 'uses_proposed'
  | 'stale';

export interface ClaimOutcome {
  readonly claim: Claim;
  readonly kind: ClaimOutcomeKind;
  readonly baselineValue: Claim['value'] | null;
  readonly proposalId: string | null;
  readonly backsDiscrepancyIds: readonly string[];
}

export interface ClassifyInput {
  readonly kind: DocumentKind;
  readonly documentId?: string;
  readonly claims: readonly Claim[];
  readonly baseline: readonly BaselineEntry[];
  readonly proposals: readonly Proposal[];
  readonly discrepancies: readonly Discrepancy[];
  readonly authority?: AuthorityTable;
}

export const classifyClaims = (input: ClassifyInput): ClaimOutcome[] => {
  const entries = new Map(
    input.baseline.map((entry) => [
      baselineKey(entry.subject, entry.attribute),
      entry,
    ]),
  );
  const active = input.proposals.filter(isActive);
  const open = input.discrepancies.filter(
    (discrepancy) => discrepancy.status === 'open',
  );

  return input.claims.map((claim): ClaimOutcome => {
    const entry = entries.get(baselineKey(claim.subject, claim.attribute));
    const baselineValue = entry?.value ?? null;
    const proposal = active.find((candidate) =>
      candidate.changes.some(
        (change) =>
          change.subject === claim.subject &&
          change.attribute === claim.attribute &&
          change.after === claim.value,
      ),
    );
    const replaces =
      proposal !== undefined &&
      input.documentId !== undefined &&
      proposal.documentId === input.documentId;
    const outcome = (
      kind: ClaimOutcomeKind,
      backsDiscrepancyIds: readonly string[] = [],
    ): ClaimOutcome => ({
      claim,
      kind,
      baselineValue,
      proposalId:
        kind === 'corroborates' || kind === 'uses_proposed'
          ? (proposal?.id ?? null)
          : null,
      backsDiscrepancyIds,
    });

    if (!entry) return outcome('unknown');

    if (claim.role === 'usa') {
      if (claim.value === entry.value) return outcome('uses_current');
      return outcome(proposal ? 'uses_proposed' : 'stale');
    }

    const authoritative = hasAuthority(
      input.kind,
      claim.attribute,
      input.authority,
    );
    const backs = authoritative
      ? open
          .filter(
            (discrepancy) =>
              discrepancy.subject === claim.subject &&
              discrepancy.attribute === claim.attribute &&
              discrepancy.value === claim.value,
          )
          .map((discrepancy) => discrepancy.id)
      : [];

    if (claim.value === entry.value) return outcome('same');
    if (replaces) return outcome('change', backs);
    if (proposal) return outcome('corroborates', backs);
    return authoritative ? outcome('change', backs) : outcome('discrepancy');
  });
};
