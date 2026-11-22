import type { DeliveryRecord } from '../../domain/Delivery.ts';
import {
  type FollowUpSettings,
  type FollowUpStep,
  followUpStep,
} from '../../domain/FollowUp.ts';
import type { Notification } from '../../domain/Notification.ts';
import type { DeliveryQueue } from '../ports/DeliveryQueue.ts';
import type { NotificationRepository } from '../ports/NotificationRepository.ts';

export interface FollowedNotice {
  readonly notification: Notification;
  readonly step: FollowUpStep;
  readonly reminders: number;
}

export const followUpStateOf = (
  notification: Notification,
  deliveries: readonly DeliveryRecord[],
) => {
  const own = deliveries.filter(
    (delivery) => delivery.notificationId === notification.id,
  );
  const reminders = own.filter((delivery) => delivery.kind === 'reminder');
  const lastContactAt = own.reduce(
    (latest, delivery) =>
      delivery.createdAt > latest ? delivery.createdAt : latest,
    notification.sentAt,
  );
  return {
    lastContactAt,
    reminders: reminders.length,
    lastReminderAt: reminders[reminders.length - 1]?.createdAt ?? null,
    escalated: notification.context?.escalatedAt !== undefined,
  };
};

export class FollowUpNotices {
  private readonly notifications: NotificationRepository;
  private readonly queue: DeliveryQueue;
  private readonly settings: FollowUpSettings;

  constructor(
    notifications: NotificationRepository,
    queue: DeliveryQueue,
    settings: FollowUpSettings,
  ) {
    this.notifications = notifications;
    this.queue = queue;
    this.settings = settings;
  }

  async execute(
    awaiting: readonly Notification[],
    now = new Date(),
  ): Promise<FollowedNotice[]> {
    if (awaiting.length === 0) return [];
    const deliveries = await this.queue.listFor(
      awaiting.map((notification) => notification.id),
    );
    const followed: FollowedNotice[] = [];
    for (const notification of awaiting) {
      const state = followUpStateOf(notification, deliveries);
      const step = followUpStep(state, now, this.settings);
      if (step === 'wait') continue;
      if (step === 'remind') {
        const queued = await this.queue.remind(notification.id, now);
        if (!queued) continue;
        followed.push({ notification, step, reminders: state.reminders + 1 });
        continue;
      }
      followed.push({ notification, step, reminders: state.reminders });
    }
    const escalated = followed
      .filter((item) => item.step === 'escalate')
      .map((item) => item.notification.id);
    if (escalated.length > 0) {
      await this.notifications.markEscalated(escalated, now);
    }
    return followed;
  }
}
