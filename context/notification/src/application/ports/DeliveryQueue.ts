import type { DeliveryRecord, PendingDelivery } from '../../domain/Delivery.ts';
import type { Channel } from '../../domain/Stakeholder.ts';

export interface SentDelivery {
  readonly providerId: string;
  readonly channel: Channel;
  readonly note: string | null;
}

export interface DeliveryQueue {
  claim(limit: number, now: Date): Promise<PendingDelivery[]>;
  markSent(id: string, sent: SentDelivery, at: Date): Promise<void>;
  markSkipped(id: string, reason: string): Promise<void>;
  retry(id: string, error: string, at: Date): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  listFor(notificationIds: readonly string[]): Promise<DeliveryRecord[]>;
}
