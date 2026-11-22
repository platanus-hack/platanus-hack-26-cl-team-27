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

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const renderEmail = (
  notification: Notification,
  baseUrl: string,
): Email => {
  const url = new URL(notification.link, baseUrl).toString();
  const text = [
    notification.title,
    '',
    ...notification.findings.flatMap((finding) => [
      `• ${finding.summary}`,
      ...finding.details.map((detail) => `  - ${detail}`),
      `  Qué hacer: ${finding.action}`,
      '',
    ]),
    `Revisa el cambio y responde: ${url}`,
  ].join('\n');
  const findings = notification.findings
    .map(
      (finding) =>
        `<li><p><strong>${escapeHtml(finding.summary)}</strong></p>${
          finding.details.length > 0
            ? `<ul>${finding.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>`
            : ''
        }<p>Qué hacer: ${escapeHtml(finding.action)}</p></li>`,
    )
    .join('');
  const html = `<h2>${escapeHtml(notification.title)}</h2><ul>${findings}</ul><p><a href="${escapeHtml(url)}">Revisa el cambio y responde</a></p>`;
  return { subject: notification.title, text, html };
};
