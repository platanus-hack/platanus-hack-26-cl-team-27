export const DRIVE_METADATA_SCOPE =
  'https://www.googleapis.com/auth/drive.metadata.readonly';

const WATCH_SCOPES: readonly string[] = [
  DRIVE_METADATA_SCOPE,
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive',
];

export interface PushChannel {
  readonly id: string;
  readonly resourceId: string;
  readonly token: string;
  readonly expiresAt: Date;
}

export interface Editor {
  readonly name: string | null;
  readonly email: string | null;
}

export interface PushNotice {
  readonly channelId: string;
  readonly resourceId: string | null;
  readonly token: string | null;
  readonly state: string;
  readonly changed: readonly string[];
}

export type NoticeAction = 'check' | 'gone' | 'ignore';

const CHECKED_PARTS = new Set(['content', 'properties']);

export const canWatch = (scopes: readonly string[]): boolean =>
  scopes.some((scope) => WATCH_SCOPES.includes(scope));

export const needsRenewal = (
  channel: PushChannel | null,
  now: Date,
  marginMs: number,
): boolean =>
  channel === null || channel.expiresAt.getTime() - marginMs <= now.getTime();

export const noticeAction = (notice: PushNotice): NoticeAction => {
  switch (notice.state) {
    case 'sync':
      return 'ignore';
    case 'trash':
    case 'remove':
      return 'gone';
    case 'update':
      return notice.changed.length === 0 ||
        notice.changed.some((part) => CHECKED_PARTS.has(part))
        ? 'check'
        : 'ignore';
    default:
      return 'check';
  }
};

export const parseChanged = (header: string | undefined): string[] =>
  (header ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

export const sameSecret = (expected: string, given: string | null): boolean => {
  if (given === null || given.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ given.charCodeAt(index);
  }
  return diff === 0;
};

export const editorLabel = (editor: Editor | null): string | null =>
  editor === null ? null : (editor.name ?? editor.email);
