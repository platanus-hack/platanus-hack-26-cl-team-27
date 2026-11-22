import { emailAddress } from './Delivery.ts';
import {
  type ConflictPart,
  conflictTitle,
  type FindingTopic,
  type NoticeClash,
  type NoticeConflict,
  type NoticeContext,
  type NoticeImpact,
  noticeKindOf,
} from './Notice.ts';
import type { Channel, Stakeholder } from './Stakeholder.ts';

export const RESPONSE_KINDS = ['reviewed', 'issue'] as const;

export type ResponseKind = (typeof RESPONSE_KINDS)[number];

export const MAX_NOTE_LENGTH = 280;

export interface NotificationFinding {
  readonly summary: string;
  readonly details: readonly string[];
  readonly action: string;
  readonly topic?: FindingTopic;
}

export interface NotificationResponse {
  readonly kind: ResponseKind;
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
  readonly email: string | null;
}

export interface Notification extends Omit<NotificationDraft, 'email'> {
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
        },
        email: emailAddress(stakeholder.handle),
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
        email: emailAddress(stakeholder.handle),
      },
    ];
  });
};

export const isChangeNotice = (
  notification: Pick<Notification, 'context'>,
): boolean => noticeKindOf(notification.context) === 'change';

export const withClashes = (
  context: NoticeContext | null,
  clashes: readonly NoticeClash[],
): NoticeContext => ({
  role: context?.role ?? '',
  recipientName: context?.recipientName ?? '',
  impact: context?.impact ?? null,
  clashes,
});

export const normalizeNote = (
  note: string | null | undefined,
): string | null => {
  const trimmed = note?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};
