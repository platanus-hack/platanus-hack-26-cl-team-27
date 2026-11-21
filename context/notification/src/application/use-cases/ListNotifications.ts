import type { Notification } from '../../domain/Notification.ts';
import type {
  NotificationFilter,
  NotificationRepository,
} from '../ports/NotificationRepository.ts';

export class ListNotifications {
  private readonly notifications: NotificationRepository;

  constructor(notifications: NotificationRepository) {
    this.notifications = notifications;
  }

  execute(filter: NotificationFilter = {}): Promise<Notification[]> {
    if (filter.changeIds?.length === 0) return Promise.resolve([]);
    return this.notifications.list(filter);
  }
}
