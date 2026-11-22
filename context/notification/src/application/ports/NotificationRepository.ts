import type {
  Notification,
  NotificationDraft,
  NotificationResponse,
} from '../../domain/Notification.ts';
import type { NoticeClash } from '../../domain/Notice.ts';

export interface NotificationFilter {
  readonly changeIds?: readonly string[];
  readonly stakeholderId?: string;
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
  setClashes(
    changeId: string,
    clashes: readonly NoticeClash[],
  ): Promise<number>;
}
