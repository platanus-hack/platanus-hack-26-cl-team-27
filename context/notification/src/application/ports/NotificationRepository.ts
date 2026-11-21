import type {
  Notification,
  NotificationDraft,
  NotificationResponse,
} from '../../domain/Notification.ts';

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
}
