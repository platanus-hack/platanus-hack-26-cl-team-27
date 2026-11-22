import type { ChannelSenders } from '@team27/context-notification';
import {
  GmailEmailSender,
  WebhookSender,
} from '@team27/context-notification/adapters';

export interface ChannelSettings {
  readonly gmailClientId?: string | undefined;
  readonly gmailClientSecret?: string | undefined;
  readonly gmailRefreshToken?: string | undefined;
  readonly emailFrom: string;
  readonly slackWebhookUrl?: string | undefined;
  readonly teamsWebhookUrl?: string | undefined;
}

export const MISSING_CHANNELS_MESSAGE =
  'Apagado: falta configurar un canal (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET y GMAIL_REFRESH_TOKEN, SLACK_WEBHOOK_URL o TEAMS_WEBHOOK_URL)';

export const buildChannelSenders = (
  settings: ChannelSettings,
): ChannelSenders => {
  const {
    gmailClientId: clientId,
    gmailClientSecret: clientSecret,
    gmailRefreshToken: refreshToken,
  } = settings;
  const chat = settings.slackWebhookUrl
    ? new WebhookSender(settings.slackWebhookUrl, 'slack')
    : settings.teamsWebhookUrl
      ? new WebhookSender(settings.teamsWebhookUrl, 'teams')
      : null;
  return {
    ...(clientId && clientSecret && refreshToken
      ? {
          email: new GmailEmailSender(
            { clientId, clientSecret, refreshToken },
            settings.emailFrom,
          ),
        }
      : {}),
    ...(chat ? { slack: chat } : {}),
  };
};
