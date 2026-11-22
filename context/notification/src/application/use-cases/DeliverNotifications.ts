import {
  type ChannelRedirects,
  MAX_ATTEMPTS,
  renderDelivery,
  retryDelayMs,
  routeDelivery,
} from '../../domain/Delivery.ts';
import { CHANNELS } from '../../domain/Stakeholder.ts';
import type { ChannelSenders } from '../ports/ChannelSender.ts';
import type { DeliveryQueue } from '../ports/DeliveryQueue.ts';

export interface DeliveryOptions {
  readonly baseUrl: string;
  readonly redirects?: ChannelRedirects | undefined;
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
  private readonly senders: ChannelSenders;
  private readonly options: DeliveryOptions;

  constructor(
    queue: DeliveryQueue,
    senders: ChannelSenders,
    options: DeliveryOptions,
  ) {
    this.queue = queue;
    this.senders = senders;
    this.options = options;
  }

  async execute(now = new Date()): Promise<DeliveryRound> {
    const round = { sent: 0, retried: 0, failed: 0, skipped: 0 };
    const available = CHANNELS.filter(
      (channel) => this.senders[channel] !== undefined,
    );
    const pending = await this.queue.claim(BATCH_SIZE, now);
    for (const delivery of pending) {
      const route = routeDelivery(delivery, available, this.options.redirects);
      const sender = route.channel ? this.senders[route.channel] : undefined;
      if (route.channel === null || !sender) {
        await this.queue.markSkipped(
          delivery.id,
          route.channel === null ? route.reason : 'Sin canal de envío',
        );
        round.skipped += 1;
        continue;
      }
      try {
        const providerId = await sender.send(
          {
            id: delivery.id,
            to: route.to,
            recipientName: delivery.notification.context?.recipientName ?? null,
          },
          renderDelivery(
            delivery.notification,
            this.options.baseUrl,
            route.channel,
          ),
        );
        await this.queue.markSent(
          delivery.id,
          { providerId, channel: route.channel, note: route.note },
          new Date(),
        );
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
