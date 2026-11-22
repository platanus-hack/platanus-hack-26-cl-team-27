import type { Channel, Stakeholder } from './Stakeholder.ts';

export const RESPONSE_KINDS = ['reviewed', 'issue'] as const;

export type ResponseKind = (typeof RESPONSE_KINDS)[number];

export const MAX_NOTE_LENGTH = 280;

export interface NotificationFinding {
  readonly summary: string;
  readonly details: readonly string[];
  readonly action: string;
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
}

export interface Notification extends NotificationDraft {
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
}

export const detailLink = (projectId: string, changeId: string): string =>
  `/proyectos/${encodeURIComponent(projectId)}/cambios/${changeId}`;

export const draftNotifications = (
  change: ChangeToNotify,
  stakeholders: readonly Stakeholder[],
): NotificationDraft[] => {
  const byStakeholder = new Map<string, NotificationFinding[]>();
  for (const { stakeholderId, summary, details, action } of change.findings) {
    byStakeholder.set(stakeholderId, [
      ...(byStakeholder.get(stakeholderId) ?? []),
      { summary, details, action },
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
      },
    ];
  });
};

export const normalizeNote = (
  note: string | null | undefined,
): string | null => {
  const trimmed = note?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};
