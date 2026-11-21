import type { Notification } from '../../domain/Notification.ts';
import type { NotificationRepository } from '../ports/NotificationRepository.ts';

export class GetNotification {
  private readonly notifications: NotificationRepository;

  constructor(notifications: NotificationRepository) {
    this.notifications = notifications;
  }

  execute(id: string): Promise<Notification | null> {
    return this.notifications.findById(id);
  }
}
