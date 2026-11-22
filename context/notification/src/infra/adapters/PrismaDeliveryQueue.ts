import type { PrismaClient } from '@team27/data-main';

import type { DeliveryQueue } from '../../application/ports/DeliveryQueue.ts';
import {
  CLAIM_LEASE_MS,
  MAX_AGE_MS,
  type PendingDelivery,
} from '../../domain/Delivery.ts';
import { toNotification } from './PrismaNotificationRepository.ts';

const utc = (date: Date): string => date.toISOString();

export class PrismaDeliveryQueue implements DeliveryQueue {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async claim(limit: number, now: Date): Promise<PendingDelivery[]> {
    const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
    const oldest = new Date(now.getTime() - MAX_AGE_MS);
    const claimed = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE notification_deliveries
      SET attempts = attempts + 1,
          next_attempt_at = (${utc(leaseUntil)}::timestamptz AT TIME ZONE 'UTC')
      WHERE id IN (
        SELECT id FROM notification_deliveries
        WHERE status = 'pending'
          AND next_attempt_at <= (${utc(now)}::timestamptz AT TIME ZONE 'UTC')
          AND created_at > (${utc(oldest)}::timestamptz AT TIME ZONE 'UTC')
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id`;
    if (claimed.length === 0) return [];
    const rows = await this.prisma.notificationDelivery.findMany({
      where: { id: { in: claimed.map((row) => row.id) } },
      include: { notification: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      recipient: row.recipient,
      attempts: row.attempts,
      notification: toNotification(row.notification),
    }));
  }

  async markSent(id: string, providerId: string, at: Date): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: { status: 'sent', providerId, sentAt: at, lastError: null },
    });
  }

  async markSkipped(id: string, reason: string): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: { status: 'skipped', lastError: reason },
    });
  }

  async retry(id: string, error: string, at: Date): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: { nextAttemptAt: at, lastError: error },
    });
  }

  async fail(id: string, error: string): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: { status: 'failed', lastError: error },
    });
  }
}
