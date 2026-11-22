import type { AnswerKind } from './FollowUp.ts';
import {
  type ConflictPart,
  conflictTitle,
  type FindingTopic,
  type NoticeClash,
  type NoticeConflict,
  type NoticeContext,
  type NoticeImpact,
  type NoticeKind,
  noticeKindOf,
  type NoticeDiff,
  type NoticeMemo,
  type NoticeSuggestion,
} from './Notice.ts';
import type { Channel, Stakeholder } from './Stakeholder.ts';

export const RESPONSE_KINDS = ['reviewed', 'issue', 'not_affected'] as const;

export type ResponseKind = (typeof RESPONSE_KINDS)[number];

export const MAX_NOTE_LENGTH = 280;

export interface NotificationFinding {
  readonly summary: string;
  readonly details: readonly string[];
  readonly action: string;
  readonly topic?: FindingTopic;
}

export interface NotificationResponse {
  readonly kind: AnswerKind;
  readonly note: string | null;
  readonly at: Date;
}

export interface NotificationDraft {
  readonly changeId: string;
  readonly stakeholderId: string;
  readonly channel: Channel;
  readonly title: string;
  readonly findings: readonly NotificationFinding[];
  readonly link: string;
  readonly context: NoticeContext | null;
  readonly recipient: string | null;
}

export interface Notification extends Omit<NotificationDraft, 'recipient'> {
  readonly id: string;
  readonly sentAt: Date;
  readonly response: NotificationResponse | null;
}

export interface AddressedFinding extends NotificationFinding {
  readonly stakeholderId: string;
}

export interface ChangeToNotify {
  readonly projectId: string;
  readonly changeId: string;
  readonly title: string;
  readonly findings: readonly AddressedFinding[];
  readonly impact?: NoticeImpact | null;
  readonly diffs?: readonly NoticeDiff[];
  readonly suggested?: Readonly<Record<string, NoticeSuggestion>>;
}

export const detailLink = (projectId: string, changeId: string): string =>
  `/proyectos/${encodeURIComponent(projectId)}/cambios/${changeId}`;

export const draftNotifications = (
  change: ChangeToNotify,
  stakeholders: readonly Stakeholder[],
): NotificationDraft[] => {
  const byStakeholder = new Map<string, NotificationFinding[]>();
  for (const finding of change.findings) {
    const { stakeholderId, summary, details, action, topic } = finding;
    byStakeholder.set(stakeholderId, [
      ...(byStakeholder.get(stakeholderId) ?? []),
      { summary, details, action, ...(topic ? { topic } : {}) },
    ]);
  }
  return stakeholders.flatMap((stakeholder): NotificationDraft[] => {
    const findings = byStakeholder.get(stakeholder.id);
    if (!findings) return [];
    return [
      {
        changeId: change.changeId,
        stakeholderId: stakeholder.id,
        channel: stakeholder.channel,
        title: change.title,
        findings,
        link: detailLink(change.projectId, change.changeId),
        context: {
          role: stakeholder.role,
          recipientName: stakeholder.name,
          impact: change.impact ?? null,
          clashes: [],
          ...(change.diffs && change.diffs.length > 0
            ? { diffs: change.diffs }
            : {}),
          ...(change.suggested?.[stakeholder.id]
            ? { suggested: change.suggested[stakeholder.id] }
            : {}),
        },
        recipient: stakeholder.handle.trim() || null,
      },
    ];
  });
};

export interface ConflictRecipient {
  readonly stakeholderId: string;
  readonly changeId: string;
  readonly part: ConflictPart;
  readonly votes: boolean;
}

export interface ConflictToNotify {
  readonly projectId: string;
  readonly conflict: Omit<NoticeConflict, 'part' | 'votes'>;
  readonly impact?: NoticeImpact | null;
  readonly recipients: readonly ConflictRecipient[];
}

export const draftConflictNotices = (
  input: ConflictToNotify,
  stakeholders: readonly Stakeholder[],
): NotificationDraft[] => {
  const seen = new Set<string>();
  return input.recipients.flatMap((recipient): NotificationDraft[] => {
    const stakeholder = stakeholders.find(
      (candidate) => candidate.id === recipient.stakeholderId,
    );
    if (!stakeholder || seen.has(stakeholder.id)) return [];
    seen.add(stakeholder.id);
    return [
      {
        changeId: recipient.changeId,
        stakeholderId: stakeholder.id,
        channel: stakeholder.channel,
        title: conflictTitle(input.conflict),
        findings: [],
        link: detailLink(input.projectId, recipient.changeId),
        context: {
          kind: 'conflict',
          role: stakeholder.role,
          recipientName: stakeholder.name,
          impact: input.impact ?? null,
          clashes: [],
          conflict: {
            ...input.conflict,
            part: recipient.part,
            votes: recipient.votes,
          },
        },
        recipient: stakeholder.handle.trim() || null,
      },
    ];
  });
};

export interface MemoToNotify {
  readonly projectId: string;
  readonly changeId: string;
  readonly kind: Exclude<NoticeKind, 'change' | 'conflict'>;
  readonly memo: NoticeMemo;
  readonly impact?: NoticeImpact | null;
  readonly recipientIds: readonly string[];
}

export const draftMemoNotices = (
  input: MemoToNotify,
  stakeholders: readonly Stakeholder[],
): NotificationDraft[] =>
  [...new Set(input.recipientIds)].flatMap((id): NotificationDraft[] => {
    const stakeholder = stakeholders.find((candidate) => candidate.id === id);
    if (!stakeholder) return [];
    return [
      {
        changeId: input.changeId,
        stakeholderId: stakeholder.id,
        channel: stakeholder.channel,
        title: input.memo.subject,
        findings: [],
        link: detailLink(input.projectId, input.changeId),
        context: {
          kind: input.kind,
          role: stakeholder.role,
          recipientName: stakeholder.name,
          impact: input.impact ?? null,
          clashes: [],
          memo: input.memo,
        },
        recipient: stakeholder.handle.trim() || null,
      },
    ];
  });

export const expectsAnswer = (
  notification: Pick<Notification, 'context'>,
): boolean => {
  const kind = noticeKindOf(notification.context);
  return (
    kind === 'change' ||
    (kind === 'conflict' && notification.context?.conflict?.votes === true)
  );
};

export const isChangeNotice = (
  notification: Pick<Notification, 'context'>,
): boolean => noticeKindOf(notification.context) === 'change';

export const withClashes = (
  context: NoticeContext | null,
  clashes: readonly NoticeClash[],
): NoticeContext => ({
  ...context,
  role: context?.role ?? '',
  recipientName: context?.recipientName ?? '',
  impact: context?.impact ?? null,
  clashes,
});

export const withReason = (
  context: NoticeContext | null,
  why: string,
  whyBy: string,
): NoticeContext => ({
  ...context,
  role: context?.role ?? '',
  recipientName: context?.recipientName ?? '',
  impact: context?.impact ?? null,
  clashes: context?.clashes ?? [],
  why,
  whyBy,
});

export const normalizeNote = (
  note: string | null | undefined,
): string | null => {
  const trimmed = note?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};
