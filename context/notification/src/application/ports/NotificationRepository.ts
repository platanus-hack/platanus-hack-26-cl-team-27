import type {
  Notification,
  NotificationDraft,
  NotificationResponse,
} from '../../domain/Notification.ts';
import type { NoticeClash, NoticeKind } from '../../domain/Notice.ts';

export interface NotificationFilter {
  readonly changeIds?: readonly string[];
  readonly stakeholderId?: string;
  readonly kind?: NoticeKind;
}

export interface NotificationRepository {
  saveMany(drafts: readonly NotificationDraft[]): Promise<Notification[]>;
  list(filter: NotificationFilter): Promise<Notification[]>;
  respond(
    id: string,
    response: NotificationResponse,
  ): Promise<Notification | null>;
  clearResponse(id: string): Promise<Notification | null>;
  findById(id: string): Promise<Notification | null>;
  markEscalated(ids: readonly string[], at: Date): Promise<void>;
  setClashes(
    changeId: string,
    clashes: readonly NoticeClash[],
  ): Promise<number>;
  setReasons(
    changeId: string,
    reasons: readonly NoticeReasonNote[],
  ): Promise<number>;
}

export interface NoticeReasonNote {
  readonly stakeholderId: string;
  readonly why: string;
  readonly whyBy: string;
}
