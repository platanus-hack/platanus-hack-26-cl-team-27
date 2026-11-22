import type { PendingDelivery } from '../../domain/Delivery.ts';

export interface DeliveryQueue {
  claim(limit: number, now: Date): Promise<PendingDelivery[]>;
  markSent(id: string, providerId: string, at: Date): Promise<void>;
  markSkipped(id: string, reason: string): Promise<void>;
  retry(id: string, error: string, at: Date): Promise<void>;
  fail(id: string, error: string): Promise<void>;
}
