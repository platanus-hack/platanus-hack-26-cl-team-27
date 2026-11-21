import {
  type ChangeToNotify,
  draftNotifications,
  type Notification,
} from '../../domain/Notification.ts';
import type { NotificationRepository } from '../ports/NotificationRepository.ts';
import type { StakeholderDirectory } from '../ports/StakeholderDirectory.ts';

export class NotifyStakeholders {
  private readonly directory: StakeholderDirectory;
  private readonly notifications: NotificationRepository;

  constructor(
    directory: StakeholderDirectory,
    notifications: NotificationRepository,
  ) {
    this.directory = directory;
    this.notifications = notifications;
  }

  async execute(change: ChangeToNotify): Promise<Notification[]> {
    const drafts = draftNotifications(change, await this.directory.list());
    if (drafts.length === 0) return [];
    return this.notifications.saveMany(drafts);
  }
}
