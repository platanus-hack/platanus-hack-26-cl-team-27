import type { PrismaClient } from '@team27/data-main';

import type {
  DeliveryQueue,
  SentDelivery,
} from '../../application/ports/DeliveryQueue.ts';
import {
  CLAIM_LEASE_MS,
  type DeliveryKind,
  type DeliveryRecord,
  type DeliveryStatus,
  MAX_AGE_MS,
  type PendingDelivery,
} from '../../domain/Delivery.ts';
import type { Channel } from '../../domain/Stakeholder.ts';
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
      kind: row.kind as DeliveryKind,
      channel: row.channel as Channel,
      recipient: row.recipient,
      attempts: row.attempts,
      notification: toNotification(row.notification),
    }));
  }

  async markSent(id: string, sent: SentDelivery, at: Date): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: {
        status: 'sent',
        channel: sent.channel,
        providerId: sent.providerId,
        sentAt: at,
        lastError: sent.note,
      },
    });
  }

  async listFor(notificationIds: readonly string[]): Promise<DeliveryRecord[]> {
    const rows = await this.prisma.notificationDelivery.findMany({
      where: { notificationId: { in: [...notificationIds] } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      notificationId: row.notificationId,
      kind: row.kind as DeliveryKind,
      channel: row.channel as Channel,
      status: row.status as DeliveryStatus,
      reason: row.lastError,
      attempts: row.attempts,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
    }));
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

  async remind(notificationId: string, at: Date): Promise<boolean> {
    const first = await this.prisma.notificationDelivery.findFirst({
      where: { notificationId, kind: 'notice' },
      orderBy: { createdAt: 'asc' },
      include: { notification: true },
    });
    if (!first) return false;
    await this.prisma.notificationDelivery.create({
      data: {
        projectId: first.projectId,
        notificationId,
        kind: 'reminder',
        channel: first.notification.channel,
        recipient: first.recipient,
        nextAttemptAt: at,
        createdAt: at,
      },
    });
    return true;
  }
}
