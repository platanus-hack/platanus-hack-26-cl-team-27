import type {
  ChannelSender,
  OutgoingDelivery,
} from '../../application/ports/ChannelSender.ts';
import type { RenderedNotice } from '../../domain/Notice.ts';

export const WEBHOOK_FORMATS = ['slack', 'teams'] as const;

export type WebhookFormat = (typeof WEBHOOK_FORMATS)[number];

const PROVIDER: Readonly<Record<WebhookFormat, string>> = {
  slack: 'Slack',
  teams: 'Teams',
};

export const teamsText = (slack: string): string =>
  slack
    .replace(/<(https?:\/\/[^|>\s]+)\|([^>]+)>/g, '[$2]($1)')
    .replace(/\*([^*\n]+)\*/g, '**$1**')
    .split('\n')
    .join('\n\n');

const addressee = (delivery: OutgoingDelivery): string | null => {
  const name = delivery.recipientName?.trim();
  const handle = delivery.to.trim();
  if (name && handle) return `Para ${name} (${handle})`;
  if (name || handle) return `Para ${name || handle}`;
  return null;
};

export const webhookBody = (
  format: WebhookFormat,
  delivery: OutgoingDelivery,
  rendered: RenderedNotice,
): unknown => {
  const header = addressee(delivery);
  if (format === 'slack') {
    return { text: [...(header ? [header] : []), rendered.text].join('\n') };
  }
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            ...(header
              ? [
                  {
                    type: 'TextBlock',
                    text: header,
                    isSubtle: true,
                    wrap: true,
                  },
                ]
              : []),
            { type: 'TextBlock', text: teamsText(rendered.text), wrap: true },
          ],
        },
      },
    ],
  };
};

export class WebhookSender implements ChannelSender {
  private readonly url: string;
  private readonly format: WebhookFormat;
  private readonly fetcher: typeof fetch;

  constructor(
    url: string,
    format: WebhookFormat,
    fetcher: typeof fetch = fetch,
  ) {
    this.url = url;
    this.format = format;
    this.fetcher = fetcher;
  }

  async send(
    delivery: OutgoingDelivery,
    rendered: RenderedNotice,
  ): Promise<string> {
    const response = await this.fetcher(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(webhookBody(this.format, delivery, rendered)),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      throw new Error(
        `${PROVIDER[this.format]} respondió ${response.status}: ${detail || 'sin detalle'}`,
      );
    }
    return `${this.format}:${delivery.id}`;
  }
}
