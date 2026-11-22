import type { DeliveryRecord } from '../../domain/Delivery.ts';
import type { DeliveryQueue } from '../ports/DeliveryQueue.ts';

export class ListDeliveries {
  private readonly queue: DeliveryQueue;

  constructor(queue: DeliveryQueue) {
    this.queue = queue;
  }

  execute(notificationIds: readonly string[]): Promise<DeliveryRecord[]> {
    if (notificationIds.length === 0) return Promise.resolve([]);
    return this.queue.listFor(notificationIds);
  }
}
