import { request, type Auth } from './http';
import type { FactValue } from './format';
import {
  isActive,
  type Progress,
  type ProposalStatus,
  type ProposalView,
} from './proposals-api';
import type { SpaceView } from './spaces-api';

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
  readonly at: string | null;
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
  (item.type === 'vote' ? item.sentAt : item.at) ?? '';

export const isPending = (item: InboxItem): boolean =>
  item.type === 'vote'
    ? item.response === null && isActive(item.status)
    : item.type !== 'filtered';

const RANK: Record<InboxItem['type'], number> = {
  vote: 0,
  discrepancy: 1,
  stale: 2,
  filtered: 3,
};

const newestFirst = (a: string, b: string): number => b.localeCompare(a);

const answeredAt = (vote: InboxVote): string =>
  vote.response?.at ?? vote.sentAt;

export interface InboxGroups {
  readonly pending: readonly InboxItem[];
  readonly info: readonly InboxFiltered[];
  readonly answered: readonly InboxVote[];
}

export const groupInbox = (items: readonly InboxItem[]): InboxGroups => ({
  pending: items
    .filter(isPending)
    .sort(
      (a, b) =>
        RANK[a.type] - RANK[b.type] || newestFirst(itemTime(a), itemTime(b)),
    ),
  info: items
    .filter((item): item is InboxFiltered => item.type === 'filtered')
    .sort((a, b) => newestFirst(a.at, b.at)),
  answered: items
    .filter(
      (item): item is InboxVote => item.type === 'vote' && !isPending(item),
    )
    .sort((a, b) => newestFirst(answeredAt(a), answeredAt(b))),
});

export const publicInbox = (
  castId: string,
  proposals: readonly ProposalView[],
  spaces: readonly SpaceView[],
): InboxItem[] => {
  const votes = proposals.flatMap((proposal): InboxVote[] => {
    const reviewer = proposal.reviewers.find(
      (candidate) => candidate.stakeholderId === castId,
    );
    if (!reviewer) return [];
    return [
      {
        type: 'vote',
        id: reviewer.notificationId ?? `${proposal.id}:${castId}`,
        notificationId: reviewer.notificationId ?? '',
        proposalId: proposal.id,
        changeId: proposal.changeId,
        title: proposal.title,
        sentAt: proposal.openedAt,
        findings: [],
        costDelta: proposal.costDelta,
        delayDays: proposal.delayDays,
        progress: proposal.progress,
        status: proposal.status,
        response: reviewer.decision
          ? {
              kind: reviewer.decision === 'approve' ? 'reviewed' : 'issue',
              note: reviewer.note,
              at: reviewer.at ?? proposal.openedAt,
            }
          : null,
        link: `/cambios/${proposal.changeId}?para=${encodeURIComponent(castId)}`,
      },
    ];
  });
  const filtered = proposals.flatMap((proposal): InboxFiltered[] => {
    const entry = proposal.filtered.find(
      (candidate) => candidate.stakeholderId === castId,
    );
    return entry
      ? [
          {
            type: 'filtered',
            id: `${proposal.id}:${castId}`,
            proposalId: proposal.id,
            changeId: proposal.changeId,
            title: proposal.title,
            reason: entry.reason,
            at: proposal.openedAt,
          },
        ]
      : [];
  });
  const stale = spaces.flatMap((space) =>
    space.documents
      .filter(
        (document) => document.ownerId === castId && document.state === 'stale',
      )
      .flatMap((document): InboxStale[] => {
        const revision =
          document.revisions.find((candidate) => candidate.current) ??
          document.revisions.at(-1);
        if (!revision) return [];
        return document.staleFacts.map((fact) => ({
          type: 'stale',
          id: `${revision.id}:${fact.subjectId}.${fact.attribute}`,
          documentId: document.id,
          documentTitle: document.title,
          revisionId: revision.id,
          revisionLabel: revision.label,
          subjectId: fact.subjectId,
          attribute: fact.attribute,
          label: fact.label,
          usedValue: fact.usedValue,
          currentValue: fact.currentValue,
          unit: fact.unit,
          at: revision.capturedAt,
        }));
      }),
  );
  return [...votes, ...stale, ...filtered];
};
