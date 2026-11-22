import type { NoticeClash } from '../../domain/Notice.ts';
import type { NotificationRepository } from '../ports/NotificationRepository.ts';

export interface AttachClashesInput {
  readonly changeId: string;
  readonly clashes: readonly NoticeClash[];
}

export class AttachClashes {
  private readonly notifications: NotificationRepository;

  constructor(notifications: NotificationRepository) {
    this.notifications = notifications;
  }

  async execute(input: AttachClashesInput): Promise<number> {
    if (input.clashes.length === 0) return 0;
    return this.notifications.setClashes(input.changeId, input.clashes);
  }
}
