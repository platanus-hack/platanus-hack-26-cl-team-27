import { type Notice, noticeRoleOf, renderNotice } from './Notice.ts';
import type { Notification } from './Notification.ts';

export const MAX_ATTEMPTS = 5;

export const CLAIM_LEASE_MS = 5 * 60_000;

export const MAX_AGE_MS = 24 * 60 * 60_000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailAddress = (handle: string): string | null =>
  EMAIL.test(handle.trim()) ? handle.trim() : null;

export const retryDelayMs = (attempts: number): number =>
  Math.min(60_000 * 4 ** Math.max(attempts - 1, 0), 60 * 60_000);

export interface PendingDelivery {
  readonly id: string;
  readonly recipient: string | null;
  readonly attempts: number;
  readonly notification: Notification;
}

export interface Email {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export const noticeOf = (
  notification: Notification,
  baseUrl: string,
  why: string | null = null,
): Notice => ({
  title: notification.title,
  findings: notification.findings,
  url: new URL(notification.link, baseUrl).toString(),
  recipientName: notification.context?.recipientName ?? null,
  impact: notification.context?.impact ?? null,
  clashes: notification.context?.clashes ?? [],
  why,
});

export const renderEmail = (
  notification: Notification,
  baseUrl: string,
): Email => {
  const rendered = renderNotice(
    noticeOf(notification, baseUrl),
    noticeRoleOf(notification.context?.role ?? '', notification.findings),
    'email',
  );
  return {
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html ?? '',
  };
};
