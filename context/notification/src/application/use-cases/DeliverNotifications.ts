import {
  MAX_ATTEMPTS,
  renderEmail,
  retryDelayMs,
} from '../../domain/Delivery.ts';
import type { DeliveryQueue } from '../ports/DeliveryQueue.ts';
import type { EmailSender } from '../ports/EmailSender.ts';

export interface DeliveryOptions {
  readonly baseUrl: string;
  readonly redirectTo?: string | undefined;
}

const BATCH_SIZE = 10;

export interface DeliveryRound {
  readonly sent: number;
  readonly retried: number;
  readonly failed: number;
  readonly skipped: number;
}

const reasonOf = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 500);

export class DeliverNotifications {
  private readonly queue: DeliveryQueue;
  private readonly sender: EmailSender;
  private readonly options: DeliveryOptions;

  constructor(
    queue: DeliveryQueue,
    sender: EmailSender,
    options: DeliveryOptions,
  ) {
    this.queue = queue;
    this.sender = sender;
    this.options = options;
  }

  async execute(now = new Date()): Promise<DeliveryRound> {
    const round = { sent: 0, retried: 0, failed: 0, skipped: 0 };
    const pending = await this.queue.claim(BATCH_SIZE, now);
    for (const delivery of pending) {
      const to = this.options.redirectTo ?? delivery.recipient;
      if (!to) {
        await this.queue.markSkipped(
          delivery.id,
          'El afectado no tiene correo',
        );
        round.skipped += 1;
        continue;
      }
      try {
        const providerId = await this.sender.send({
          ...renderEmail(delivery.notification, this.options.baseUrl),
          to,
          idempotencyKey: delivery.id,
        });
        await this.queue.markSent(delivery.id, providerId, new Date());
        round.sent += 1;
      } catch (error) {
        if (delivery.attempts >= MAX_ATTEMPTS) {
          await this.queue.fail(delivery.id, reasonOf(error));
          round.failed += 1;
        } else {
          await this.queue.retry(
            delivery.id,
            reasonOf(error),
            new Date(now.getTime() + retryDelayMs(delivery.attempts)),
          );
          round.retried += 1;
        }
      }
    }
    return round;
  }
}
