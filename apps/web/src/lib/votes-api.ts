import { request } from './http';
import { projectApi } from './project-paths';
import type { ProposalStatus } from './proposals-api';

export const MAX_NOTE_LENGTH = 280;

export type VoteKind = 'reviewed' | 'issue' | 'not_affected';

export type OverlapVoteKind = 'se_tocan' | 'no_se_tocan';

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
  projectId: string,
  notificationId: string,
  kind: VoteKind,
  note: string,
): Promise<VoteResponse> =>
  request<VoteResponse>(
    projectApi(projectId, `/notifications/${notificationId}/response`),
    { method: 'POST', body: { kind, note: trimNote(note) }, write: true },
  );

export const castOverlapVote = (
  projectId: string,
  overlapId: string,
  kind: OverlapVoteKind,
  note = '',
): Promise<unknown> =>
  request<unknown>(projectApi(projectId, `/overlaps/${overlapId}/vote`), {
    method: 'POST',
    body: { kind, note: trimNote(note) },
    write: true,
  });
