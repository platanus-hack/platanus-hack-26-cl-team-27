import type { AnswerKind } from '../../domain/FollowUp.ts';
import { normalizeNote, type Notification } from '../../domain/Notification.ts';
import type { NotificationRepository } from '../ports/NotificationRepository.ts';

export interface ConflictAnswerInput {
  readonly stakeholderId: string;
  readonly overlapId: string;
  readonly kind: Extract<AnswerKind, 'se_tocan' | 'no_se_tocan'>;
  readonly note?: string | null;
}

export class AnswerConflictNotice {
  private readonly notifications: NotificationRepository;

  constructor(notifications: NotificationRepository) {
    this.notifications = notifications;
  }

  async execute(input: ConflictAnswerInput): Promise<Notification | null> {
    const own = await this.notifications.list({
      stakeholderId: input.stakeholderId,
      kind: 'conflict',
    });
    const notice = own.find(
      (item) => item.context?.conflict?.overlapId === input.overlapId,
    );
    if (!notice) return null;
    return this.notifications.respond(notice.id, {
      kind: input.kind,
      note: normalizeNote(input.note),
      at: new Date(),
    });
  }
}
