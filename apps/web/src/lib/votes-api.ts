import { request, type Auth } from './http';
import type { ProposalStatus } from './proposals-api';

export const MAX_NOTE_LENGTH = 280;

export type VoteKind = 'reviewed' | 'issue';

export interface VoteResponse {
  readonly notification: {
    readonly id: string;
    readonly response: {
      readonly kind: VoteKind;
      readonly note: string | null;
      readonly at: string;
    } | null;
  };
  readonly proposal: {
    readonly id: string;
    readonly status: ProposalStatus;
    readonly approved: number;
    readonly required: number;
    readonly missing: readonly string[];
  };
  readonly merged: boolean;
  readonly stale: readonly {
    readonly revisionId: string;
    readonly subjectId: string;
    readonly attribute: string;
  }[];
  readonly projectVersion: number;
}

export const trimNote = (note: string): string | undefined => {
  const trimmed = note.trim().slice(0, MAX_NOTE_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
};

export const castVote = (
  notificationId: string,
  kind: VoteKind,
  note: string,
  auth: Auth,
): Promise<VoteResponse> =>
  request<VoteResponse>(`/api/notifications/${notificationId}/response`, {
    method: 'POST',
    body: { kind, note: trimNote(note) },
    ...auth,
  });

export const dismissDiscrepancy = (
  discrepancyId: string,
  auth: Auth,
): Promise<void> =>
  request<void>(`/api/discrepancies/${discrepancyId}/dismiss`, {
    method: 'POST',
    body: {},
    ...auth,
  });

export const acknowledgeStale = (
  revisionId: string,
  note: string,
  auth: Auth,
): Promise<void> =>
  request<void>('/api/stale/acknowledge', {
    method: 'POST',
    body: { revisionId, note: note.trim() },
    ...auth,
  });
