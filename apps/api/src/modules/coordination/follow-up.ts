import {
  isActive,
  isLiveOverlap,
  type Overlap,
  type Proposal,
} from '@team27/context-lake';
import {
  type AnswerKind,
  expectsAnswer,
  type FollowedNotice,
  followUpStateOf,
  noticeKindOf,
  type Notification,
  type PendingPerson,
} from '@team27/context-notification';

import type { ProjectCatalog } from '../project/project-catalog.ts';
import { deliveryOf } from './notices.ts';
import { type LakeSnapshot, proposalTitle } from './views.ts';

const latestFor = (
  proposals: readonly Proposal[],
  changeId: string,
): Proposal | undefined =>
  [...proposals].reverse().find((proposal) => proposal.changeId === changeId);

export interface AwaitingInput {
  readonly notifications: readonly Notification[];
  readonly proposals: readonly Proposal[];
  readonly overlaps: readonly Overlap[];
}

export const awaitsAnswer = (
  notification: Notification,
  input: Pick<AwaitingInput, 'proposals' | 'overlaps'>,
): boolean => {
  if (notification.response !== null || !expectsAnswer(notification)) {
    return false;
  }
  const conflict = notification.context?.conflict;
  if (conflict) {
    const overlap = input.overlaps.find(
      (item) => item.id === conflict.overlapId,
    );
    return (
      overlap !== undefined &&
      isLiveOverlap(overlap) &&
      overlap.validators.includes(notification.stakeholderId) &&
      !overlap.votes.some(
        (vote) => vote.validatorId === notification.stakeholderId,
      )
    );
  }
  const proposal = latestFor(input.proposals, notification.changeId);
  return (
    proposal !== undefined &&
    isActive(proposal) &&
    proposal.reviews.some(
      (review) =>
        review.reviewerId === notification.stakeholderId &&
        review.decision === null,
    )
  );
};

export const awaitingNotices = (input: AwaitingInput): Notification[] =>
  input.notifications.filter((notification) =>
    awaitsAnswer(notification, input),
  );

export interface Escalation {
  readonly changeId: string;
  readonly about: string;
  readonly authorId: string | null;
  readonly pending: readonly (PendingPerson & { readonly id: string })[];
}

export const escalationsOf = (
  project: ProjectCatalog,
  followed: readonly FollowedNotice[],
  proposals: readonly Proposal[],
): Escalation[] => {
  const byChange = new Map<string, FollowedNotice[]>();
  for (const item of followed) {
    if (item.step !== 'escalate') continue;
    const { changeId } = item.notification;
    byChange.set(changeId, [...(byChange.get(changeId) ?? []), item]);
  }
  return [...byChange.entries()].map(([changeId, items]) => {
    const proposal = latestFor(proposals, changeId);
    const reminders = new Map<string, number>();
    for (const item of items) {
      const id = item.notification.stakeholderId;
      reminders.set(id, Math.max(reminders.get(id) ?? 0, item.reminders));
    }
    return {
      changeId,
      about: proposal
        ? proposalTitle(project, proposal)
        : (items[0]?.notification.title ?? changeId),
      authorId: proposal?.authorId ?? null,
      pending: [...reminders.entries()].map(([id, count]) => {
        const member = project.castMember(id);
        return {
          id,
          name: member?.name ?? id,
          role: member?.role ?? '',
          reminders: count,
        };
      }),
    };
  });
};

const DECISION_ANSWER = { approve: 'reviewed', dispute: 'issue' } as const;

const WEIGHT: Readonly<Record<string, number>> = { issue: 0, se_tocan: 0 };

export const followUpView = (snapshot: LakeSnapshot, proposal: Proposal) => {
  const { project } = snapshot;
  const overlaps = snapshot.overlaps.filter(
    (overlap) =>
      overlap.proposalId === proposal.id ||
      overlap.otherProposalId === proposal.id,
  );
  const person = (
    stakeholderId: string,
    about: 'change' | 'conflict',
    notification: Notification | undefined,
    answer: AnswerKind | null,
    note: string | null,
    answeredAt: Date | string | null,
  ) => {
    const member = project.castMember(stakeholderId);
    const state = notification
      ? followUpStateOf(notification, snapshot.deliveries)
      : null;
    return {
      stakeholderId,
      name: member?.name ?? stakeholderId,
      role: member?.role ?? '',
      about,
      answer,
      note,
      answeredAt,
      awaiting: notification ? awaitsAnswer(notification, snapshot) : false,
      reminders: state?.reminders ?? 0,
      lastReminderAt: state?.lastReminderAt ?? null,
      escalatedAt: notification?.context?.escalatedAt ?? null,
      delivery: notification
        ? deliveryOf(
            snapshot.deliveries.filter((item) => item.kind === 'notice'),
            notification.id,
          )
        : null,
    };
  };
  const changeNotice = (stakeholderId: string) =>
    snapshot.notifications.find(
      (item) =>
        item.changeId === proposal.changeId &&
        item.stakeholderId === stakeholderId,
    );
  const people = [
    ...proposal.reviews.map((review) =>
      person(
        review.reviewerId,
        'change',
        changeNotice(review.reviewerId),
        review.decision ? DECISION_ANSWER[review.decision] : null,
        review.note,
        review.at,
      ),
    ),
    ...proposal.filtered
      .filter((item) => item.notAffected)
      .map((item) =>
        person(
          item.id,
          'change',
          changeNotice(item.id),
          'not_affected',
          item.reason,
          item.at ?? null,
        ),
      ),
    ...overlaps.flatMap((overlap) =>
      overlap.validators.map((validatorId) => {
        const vote = overlap.votes.find(
          (item) => item.validatorId === validatorId,
        );
        return person(
          validatorId,
          'conflict',
          snapshot.conflictNotices.find(
            (item) =>
              item.stakeholderId === validatorId &&
              item.context?.conflict?.overlapId === overlap.id,
          ),
          vote?.kind ?? null,
          vote?.note ?? null,
          vote?.at ?? null,
        );
      }),
    ),
  ]
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        (WEIGHT[a.item.answer ?? ''] ?? (a.item.awaiting ? 1 : 2)) -
          (WEIGHT[b.item.answer ?? ''] ?? (b.item.awaiting ? 1 : 2)) ||
        a.index - b.index,
    )
    .map(({ item }) => item);
  return {
    people,
    authorNotices: snapshot.authorNotices
      .filter((notice) => notice.changeId === proposal.changeId)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
      .map((notice) => ({
        id: notice.id,
        kind: noticeKindOf(notice.context),
        to: project.castName(notice.stakeholderId),
        toName: notice.context?.recipientName ?? null,
        subject: notice.title,
        lines: notice.context?.memo?.lines ?? [],
        sentAt: notice.sentAt,
        delivery: deliveryOf(snapshot.deliveries, notice.id),
      })),
  };
};

export type FollowUpView = ReturnType<typeof followUpView>;
