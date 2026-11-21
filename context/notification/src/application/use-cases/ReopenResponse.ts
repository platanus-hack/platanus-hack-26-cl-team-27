import type { Notification } from '../../domain/Notification.ts';
import type { NotificationRepository } from '../ports/NotificationRepository.ts';

export class ReopenResponse {
  private readonly notifications: NotificationRepository;

  constructor(notifications: NotificationRepository) {
    this.notifications = notifications;
  }

  execute(notificationId: string): Promise<Notification | null> {
    return this.notifications.clearResponse(notificationId);
  }
}
