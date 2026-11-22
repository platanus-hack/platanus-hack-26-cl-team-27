import {
  draftMemoNotices,
  type MemoToNotify,
  type Notification,
} from '../../domain/Notification.ts';
import type { NotificationRepository } from '../ports/NotificationRepository.ts';
import type { StakeholderDirectory } from '../ports/StakeholderDirectory.ts';

export class NotifyMemo {
  private readonly directory: StakeholderDirectory;
  private readonly notifications: NotificationRepository;

  constructor(
    directory: StakeholderDirectory,
    notifications: NotificationRepository,
  ) {
    this.directory = directory;
    this.notifications = notifications;
  }

  async execute(memo: MemoToNotify): Promise<Notification[]> {
    const drafts = draftMemoNotices(memo, await this.directory.list());
    if (drafts.length === 0) return [];
    return this.notifications.saveMany(drafts);
  }
}
