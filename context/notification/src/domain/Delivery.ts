import {
  type Notice,
  noticeRoleOf,
  type RenderedNotice,
  renderNotice,
} from './Notice.ts';
import type { Notification } from './Notification.ts';
import type { Channel } from './Stakeholder.ts';

export const MAX_ATTEMPTS = 5;

export const CLAIM_LEASE_MS = 5 * 60_000;

export const MAX_AGE_MS = 24 * 60 * 60_000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailAddress = (handle: string): string | null =>
  EMAIL.test(handle.trim()) ? handle.trim() : null;

export const retryDelayMs = (attempts: number): number =>
  Math.min(60_000 * 4 ** Math.max(attempts - 1, 0), 60 * 60_000);

export const DELIVERY_STATUSES = [
  'pending',
  'sent',
  'skipped',
  'failed',
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_KINDS = ['notice', 'reminder'] as const;

export type DeliveryKind = (typeof DELIVERY_KINDS)[number];

export interface DeliveryRecord {
  readonly notificationId: string;
  readonly kind: DeliveryKind;
  readonly channel: Channel;
  readonly status: DeliveryStatus;
  readonly reason: string | null;
  readonly attempts: number;
  readonly sentAt: Date | null;
  readonly createdAt: Date;
}

export type ChannelRedirects = Partial<Record<Channel, string>>;

export type DeliveryRoute =
  | {
      readonly channel: Channel;
      readonly to: string;
      readonly note: string | null;
    }
  | { readonly channel: null; readonly reason: string };

const CHANNEL_NAMES: Readonly<Record<Channel, string>> = {
  email: 'correo',
  whatsapp: 'WhatsApp',
  slack: 'Slack',
};

const NEEDS_ADDRESS: readonly Channel[] = ['email', 'whatsapp'];

const PLACEHOLDER_DOMAIN = /\.(example|test|invalid|localhost)$/i;

export const isRealEmail = (address: string | null): address is string =>
  address !== null && address !== '' && !PLACEHOLDER_DOMAIN.test(address.split('@')[1] ?? '');

const redirected = (
  own: string | null,
  redirect: string | undefined,
): string | null => (isRealEmail(own) ? own : (redirect ?? own));

export const routeDelivery = (
  delivery: { readonly channel: Channel; readonly recipient: string | null },
  available: readonly Channel[],
  redirects: ChannelRedirects = {},
): DeliveryRoute => {
  const { channel } = delivery;
  const recipient = delivery.recipient?.trim() ?? '';
  const name = CHANNEL_NAMES[channel];
  if (available.includes(channel)) {
    const own = channel === 'email' ? emailAddress(recipient) : recipient;
    const to =
      channel === 'email'
        ? redirected(own, redirects.email)
        : (redirects[channel] ?? own);
    if (to || (to !== null && !NEEDS_ADDRESS.includes(channel))) {
      return { channel, to, note: null };
    }
    return {
      channel: null,
      reason:
        channel === 'email'
          ? 'El afectado no tiene correo'
          : `El afectado no tiene dirección de ${name}`,
    };
  }
  if (channel !== 'email' && available.includes('email')) {
    const to = redirected(emailAddress(recipient), redirects.email);
    if (to) {
      return {
        channel: 'email',
        to,
        note: `Sin envío por ${name}: salió por correo`,
      };
    }
  }
  return {
    channel: null,
    reason:
      channel === 'email'
        ? 'No hay envío por correo configurado'
        : `No hay envío por ${name} configurado y el afectado no tiene correo`,
  };
};

export const NOTICE_GRACE_MS = 15_000;

export interface PendingDelivery {
  readonly id: string;
  readonly kind: DeliveryKind;
  readonly channel: Channel;
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
  why: why ?? notification.context?.why ?? null,
  whyBy: why ? null : (notification.context?.whyBy ?? null),
  diffs: notification.context?.diffs ?? [],
  suggested: notification.context?.suggested ?? null,
  conflict: notification.context?.conflict ?? null,
  memo: notification.context?.memo ?? null,
});

export const renderDelivery = (
  notification: Notification,
  baseUrl: string,
  channel: Channel,
): RenderedNotice =>
  renderNotice(
    noticeOf(notification, baseUrl),
    noticeRoleOf(notification.context?.role ?? '', notification.findings),
    channel,
  );

export const renderEmail = (
  notification: Notification,
  baseUrl: string,
): Email => {
  const rendered = renderDelivery(notification, baseUrl, 'email');
  return {
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html ?? '',
  };
};
