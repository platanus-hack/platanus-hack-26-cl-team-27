import { request, type Auth } from './http';
import { formatChange, latest, type FactValue } from './format';
import type { Channel } from './room-api';

export type ProposalStatus =
  'open' | 'disputed' | 'merged' | 'withdrawn' | 'replaced';

export interface Progress {
  readonly approved: number;
  readonly required: number;
  readonly missing: readonly string[];
}

export interface ProposalDiff {
  readonly label: string;
  readonly unit: string | null;
  readonly before: FactValue | null;
  readonly after: FactValue | null;
}

export interface ProposalReviewer {
  readonly stakeholderId: string;
  readonly name: string;
  readonly role: string;
  readonly channel: Channel;
  readonly notificationId: string | null;
  readonly decision: 'approve' | 'dispute' | null;
  readonly note: string | null;
  readonly at: string | null;
}

export interface ProposalFiltered {
  readonly stakeholderId: string;
  readonly name: string;
  readonly reason: string;
}

export interface ProposalView {
  readonly id: string;
  readonly changeId: string;
  readonly title: string;
  readonly status: ProposalStatus;
  readonly elementName: string;
  readonly subjectId: string;
  readonly attribute: string;
  readonly diffs: readonly ProposalDiff[];
  readonly costDelta: number;
  readonly delayDays: number;
  readonly authorId: string;
  readonly authorName: string;
  readonly openedAt: string;
  readonly mergedAt: string | null;
  readonly reviewers: readonly ProposalReviewer[];
  readonly filtered: readonly ProposalFiltered[];
  readonly progress: Progress;
  readonly backedBy: readonly string[];
}

export interface ProposalsResponse {
  readonly proposals: readonly ProposalView[];
}

export const getProposals = (
  status?: ProposalStatus | 'active',
  signal?: AbortSignal,
): Promise<ProposalsResponse> =>
  request<ProposalsResponse>(
    `/api/proposals${status ? `?status=${status}` : ''}`,
    { signal },
  );

export const reopenProposal = (
  proposalId: string,
  auth: Auth,
): Promise<ProposalView> =>
  request<ProposalView>(`/api/proposals/${proposalId}/reopen`, {
    method: 'POST',
    body: {},
    ...auth,
  });

export const withdrawProposal = (
  proposalId: string,
  auth: Auth,
): Promise<ProposalView> =>
  request<ProposalView>(`/api/proposals/${proposalId}/withdraw`, {
    method: 'POST',
    body: {},
    ...auth,
  });

export const isActive = (status: ProposalStatus): boolean =>
  status === 'open' || status === 'disputed';

export const STATUS_LABEL: Record<ProposalStatus, string> = {
  open: 'Esperando respuestas',
  disputed: 'En disputa',
  merged: 'Fusionada',
  withdrawn: 'Retirada',
  replaced: 'Reemplazada',
};

const isProposalStatus = (status: string): status is ProposalStatus =>
  status in STATUS_LABEL;

export const toProposalStatus = (status: string): ProposalStatus | null =>
  status === 'superseded'
    ? 'replaced'
    : isProposalStatus(status)
      ? status
      : null;

export const statusLabel = (status: string): string => {
  const known = toProposalStatus(status);
  return known ? STATUS_LABEL[known] : status;
};

export const lastActivity = (proposal: ProposalView): string =>
  latest([
    proposal.openedAt,
    proposal.mergedAt,
    ...proposal.reviewers.map((reviewer) => reviewer.at),
  ]) ?? proposal.openedAt;

export const disputersOf = (
  proposal: ProposalView,
): readonly ProposalReviewer[] =>
  proposal.reviewers.filter((reviewer) => reviewer.decision === 'dispute');

export interface ProposalActions {
  readonly reopen: boolean;
  readonly withdraw: boolean;
}

export const actionsFor = (status: ProposalStatus): ProposalActions => ({
  reopen: status === 'disputed',
  withdraw: isActive(status),
});

export const byLastActivity = (
  proposals: readonly ProposalView[],
): ProposalView[] =>
  [...proposals].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));

export const splitProposals = (
  proposals: readonly ProposalView[],
): { readonly active: ProposalView[]; readonly history: ProposalView[] } => {
  const sorted = byLastActivity(proposals);
  return {
    active: sorted.filter((proposal) => isActive(proposal.status)),
    history: sorted.filter((proposal) => !isActive(proposal.status)),
  };
};

export const changeOf = (proposal: ProposalView): string =>
  proposal.diffs
    .map((diff) => formatChange(diff.before, diff.after, diff.unit))
    .join(' · ');
