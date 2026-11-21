import type { ClaimValue } from './Claim.ts';

export type DiscrepancyStatus = 'open' | 'backed' | 'dismissed';

export interface DiscrepancyDraft {
  readonly subject: string;
  readonly attribute: string;
  readonly value: ClaimValue;
  readonly baselineValue: ClaimValue;
  readonly unit: string | null;
  readonly documentId: string;
  readonly revisionId: string;
  readonly claimId: string | null;
  readonly ownerId: string;
}

export interface Discrepancy extends DiscrepancyDraft {
  readonly id: string;
  readonly status: DiscrepancyStatus;
  readonly backedByRevisionId: string | null;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
}

export interface DiscrepancyResolution {
  readonly status: 'backed' | 'dismissed';
  readonly backedByRevisionId: string | null;
  readonly note: string | null;
  readonly resolvedAt: Date;
}
