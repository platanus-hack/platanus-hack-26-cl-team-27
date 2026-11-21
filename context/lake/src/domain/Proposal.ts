import type { ClaimValue } from './Claim.ts';

export type ProposalStatus =
  | 'open'
  | 'merged'
  | 'disputed'
  | 'withdrawn'
  | 'superseded';

export type Decision = 'approve' | 'dispute';

export interface Review {
  readonly reviewerId: string;
  readonly decision: Decision | null;
  readonly note: string | null;
  readonly at: Date | null;
}

export interface ProposalChange {
  readonly attribute: string;
  readonly unit: string | null;
  readonly before: ClaimValue;
  readonly after: ClaimValue;
  readonly claimId: string | null;
}

export interface FilteredReviewer {
  readonly id: string;
  readonly reason: string;
}

export interface ProposalDraft {
  readonly subject: string;
  readonly sourceRevisionId: string;
  readonly authorId: string;
  readonly changes: readonly ProposalChange[];
  readonly before: Readonly<Record<string, ClaimValue>>;
  readonly after: Readonly<Record<string, ClaimValue>>;
}

export interface Proposal {
  readonly id: string;
  readonly changeId: string | null;
  readonly subject: string;
  readonly sourceRevisionId: string;
  readonly authorId: string;
  readonly changes: readonly ProposalChange[];
  readonly status: ProposalStatus;
  readonly reviews: readonly Review[];
  readonly filtered: readonly FilteredReviewer[];
  readonly openedAt: Date;
  readonly resolvedAt: Date | null;
  readonly supersededById: string | null;
}

export const isActive = (proposal: Pick<Proposal, 'status'>): boolean =>
  proposal.status === 'open' || proposal.status === 'disputed';

export const decideProposal = (
  proposal: Pick<Proposal, 'reviews'>,
): 'merged' | 'disputed' | 'open' => {
  if (proposal.reviews.some((review) => review.decision === 'dispute')) {
    return 'disputed';
  }
  return proposal.reviews.every((review) => review.decision === 'approve')
    ? 'merged'
    : 'open';
};

export const applyReview = (
  proposal: Proposal,
  reviewerId: string,
  decision: Decision,
  note: string | null,
  at: Date,
): Proposal => ({
  ...proposal,
  reviews: proposal.reviews.map((review) =>
    review.reviewerId === reviewerId ? { reviewerId, decision, note, at } : review,
  ),
});

export const reopenFor = (
  proposal: Proposal,
): { proposal: Proposal; reopened: string[] } => {
  const reopened = proposal.reviews
    .filter((review) => review.decision === 'dispute')
    .map((review) => review.reviewerId);
  const reviews = proposal.reviews.map(
    (review): Review =>
      review.decision === 'dispute'
        ? { reviewerId: review.reviewerId, decision: null, note: null, at: null }
        : review,
  );
  return {
    proposal: { ...proposal, reviews, status: decideProposal({ reviews }) },
    reopened,
  };
};
