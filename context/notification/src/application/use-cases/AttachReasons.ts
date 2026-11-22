import type {
  NoticeReasonNote,
  NotificationRepository,
} from '../ports/NotificationRepository.ts';

export interface AttachReasonsInput {
  readonly changeId: string;
  readonly reasons: readonly NoticeReasonNote[];
}

export class AttachReasons {
  private readonly notifications: NotificationRepository;

  constructor(notifications: NotificationRepository) {
    this.notifications = notifications;
  }

  async execute(input: AttachReasonsInput): Promise<number> {
    const reasons = input.reasons.filter((reason) => reason.why.trim() !== '');
    if (reasons.length === 0) return 0;
    return this.notifications.setReasons(input.changeId, reasons);
  }
}
