import type {
  ChannelSender,
  OutgoingDelivery,
} from '../../application/ports/ChannelSender.ts';
import type { Email } from '../../domain/Delivery.ts';
import type { RenderedNotice } from '../../domain/Notice.ts';
import { GOOGLE_TOKEN_URL } from './GmailAuthorization.ts';

const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

const TOKEN_MARGIN_MS = 60_000;

export interface GmailCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

export interface OutgoingEmail extends Email {
  readonly to: string;
  readonly idempotencyKey: string;
}

const oneLine = (value: string): string => value.replace(/[\r\n]+/g, ' ');

const encodeHeader = (value: string): string =>
  /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;

const base64Lines = (value: string): string =>
  (
    Buffer.from(value, 'utf8')
      .toString('base64')
      .match(/.{1,76}/g) ?? []
  ).join('\r\n');

export const buildRawMessage = (from: string, email: OutgoingEmail): string => {
  const boundary = `vigente-${email.idempotencyKey}`;
  const part = (type: string, body: string) => [
    `--${boundary}`,
    `Content-Type: ${type}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(body),
  ];
  const message = [
    `From: ${oneLine(from)}`,
    `To: ${oneLine(email.to)}`,
    `Subject: ${encodeHeader(oneLine(email.subject))}`,
    'MIME-Version: 1.0',
    `X-Vigente-Delivery: ${oneLine(email.idempotencyKey)}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    ...part('text/plain', email.text),
    ...part('text/html', email.html),
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return Buffer.from(message, 'utf8').toString('base64url');
};

export class GmailEmailSender implements ChannelSender {
  private readonly credentials: GmailCredentials;
  private readonly from: string;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    credentials: GmailCredentials,
    from: string,
    fetcher: typeof fetch = fetch,
    now: () => number = Date.now,
  ) {
    this.credentials = credentials;
    this.from = from;
    this.fetcher = fetcher;
    this.now = now;
  }

  async send(
    delivery: OutgoingDelivery,
    rendered: RenderedNotice,
  ): Promise<string> {
    const email: OutgoingEmail = {
      to: delivery.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html ?? '',
      idempotencyKey: delivery.id,
    };
    const token = await this.token();
    const response = await this.fetcher(SEND_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw: buildRawMessage(this.from, email) }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };
    if (response.status === 401) this.accessToken = null;
    if (!response.ok || !body.id) {
      throw new Error(
        `Gmail respondió ${response.status}: ${body.error?.message ?? 'sin detalle'}`,
      );
    }
    return body.id;
  }

  private async token(): Promise<string> {
    if (
      this.accessToken &&
      this.accessToken.expiresAt - TOKEN_MARGIN_MS > this.now()
    ) {
      return this.accessToken.value;
    }
    const response = await this.fetcher(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: this.credentials.refreshToken,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !body.access_token) {
      throw new Error(
        `Google no renovó el acceso a Gmail (${response.status}: ${body.error_description ?? body.error ?? 'sin detalle'}). Vuelve a autorizar con «pnpm gmail:auth»`,
      );
    }
    this.accessToken = {
      value: body.access_token,
      expiresAt: this.now() + (body.expires_in ?? 3600) * 1000,
    };
    return body.access_token;
  }
}
