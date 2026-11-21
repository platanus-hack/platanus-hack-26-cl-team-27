import type { ClaimValue } from './Claim.ts';

export type ProposalStatus =
  'open' | 'merged' | 'disputed' | 'withdrawn' | 'superseded';

export type Decision = 'approve' | 'dispute';

export interface Review {
  readonly reviewerId: string;
  readonly decision: Decision | null;
  readonly note: string | null;
  readonly at: Date | null;
}

export interface ProposalChange {
  readonly subject: string;
  readonly attribute: string;
  readonly unit: string | null;
  readonly before: ClaimValue;
  readonly after: ClaimValue;
  readonly claimId: string | null;
  readonly locator: string | null;
}

export interface ProposalContext {
  readonly subject: string;
  readonly attribute: string;
  readonly value: ClaimValue;
  readonly unit: string | null;
  readonly locator: string | null;
}

export interface FilteredReviewer {
  readonly id: string;
  readonly reason: string;
}

export type SubjectValues = Readonly<Record<string, ClaimValue>>;

export interface ProposalDraft {
  readonly documentId: string;
  readonly sourceRevisionId: string;
  readonly authorId: string;
  readonly changes: readonly ProposalChange[];
  readonly context: readonly ProposalContext[];
  readonly before: Readonly<Record<string, SubjectValues>>;
  readonly after: Readonly<Record<string, SubjectValues>>;
}

export interface Proposal {
  readonly id: string;
  readonly changeId: string | null;
  readonly changeIds: readonly string[];
  readonly documentId: string;
  readonly sourceRevisionId: string;
  readonly authorId: string;
  readonly changes: readonly ProposalChange[];
  readonly context: readonly ProposalContext[];
  readonly status: ProposalStatus;
  readonly reviews: readonly Review[];
  readonly filtered: readonly FilteredReviewer[];
  readonly openedAt: Date;
  readonly resolvedAt: Date | null;
  readonly supersededById: string | null;
}

export const isActive = (proposal: Pick<Proposal, 'status'>): boolean =>
  proposal.status === 'open' || proposal.status === 'disputed';

export const subjectsOf = (proposal: Pick<Proposal, 'changes'>): string[] => [
  ...new Set(proposal.changes.map((change) => change.subject)),
];

export const touches = (
  proposal: Pick<Proposal, 'changes'>,
  subject: string,
  attribute: string,
): boolean =>
  proposal.changes.some(
    (change) => change.subject === subject && change.attribute === attribute,
  );

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
    review.reviewerId === reviewerId
      ? { reviewerId, decision, note, at }
      : review,
  ),
});

export const reopenFor = (
  proposal: Proposal,
): { proposal: Proposal; reopened: string[] } => {
  const reopened = proposal.reviews
    .filter((review) => review.decision === 'dispute')
    .map((review) => review.reviewerId);
  const reviews = proposal.reviews.map((review): Review =>
    review.decision === 'dispute'
      ? { reviewerId: review.reviewerId, decision: null, note: null, at: null }
      : review,
  );
  return {
    proposal: { ...proposal, reviews, status: decideProposal({ reviews }) },
    reopened,
  };
};
