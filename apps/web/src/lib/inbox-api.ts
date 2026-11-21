import { request, type Auth } from './http';
import type { FactValue } from './format';
import type { Progress, ProposalStatus, ProposalView } from './proposals-api';

export interface InboxVote {
  readonly type: 'vote';
  readonly id: string;
  readonly notificationId: string;
  readonly proposalId: string;
  readonly changeId: string;
  readonly title: string;
  readonly sentAt: string;
  readonly findings: readonly {
    readonly summary: string;
    readonly details: readonly string[];
    readonly action: string;
  }[];
  readonly costDelta: number;
  readonly delayDays: number;
  readonly progress: Progress;
  readonly status: ProposalStatus;
  readonly response: {
    readonly kind: 'reviewed' | 'issue';
    readonly note: string | null;
    readonly at: string;
  } | null;
  readonly link: string;
}

export interface InboxDiscrepancy {
  readonly type: 'discrepancy';
  readonly id: string;
  readonly subjectName: string;
  readonly label: string;
  readonly claimedValue: FactValue;
  readonly currentValue: FactValue;
  readonly unit: string | null;
  readonly sourceTitle: string;
  readonly spaceName: string;
  readonly authorName: string;
  readonly at: string;
}

export interface InboxStale {
  readonly type: 'stale';
  readonly id: string;
  readonly documentId: string;
  readonly documentTitle: string;
  readonly revisionId: string;
  readonly revisionLabel: string;
  readonly subjectId: string;
  readonly attribute: string;
  readonly label: string;
  readonly usedValue: FactValue;
  readonly currentValue: FactValue;
  readonly unit: string | null;
  readonly at: string;
}

export interface InboxFiltered {
  readonly type: 'filtered';
  readonly id: string;
  readonly proposalId: string;
  readonly changeId: string;
  readonly title: string;
  readonly reason: string;
  readonly at: string;
}

export type InboxItem =
  InboxVote | InboxDiscrepancy | InboxStale | InboxFiltered;

export interface InboxResponse {
  readonly castId: string;
  readonly items: readonly InboxItem[];
  readonly authoring: readonly ProposalView[];
}

export const getInbox = (
  castId: string,
  auth: Auth,
  signal?: AbortSignal,
): Promise<InboxResponse> =>
  request<InboxResponse>(`/api/seats/${castId}/inbox`, { ...auth, signal });

export const itemTime = (item: InboxItem): string =>
  item.type === 'vote' ? item.sentAt : item.at;

export const isPending = (item: InboxItem): boolean =>
  item.type === 'vote'
    ? item.response === null && item.status !== 'merged'
    : item.type !== 'filtered';
