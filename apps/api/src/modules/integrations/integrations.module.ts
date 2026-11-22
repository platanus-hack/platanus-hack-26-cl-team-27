import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectGoogle,
  DisconnectGoogle,
  GetGoogleConnection,
  LinkSpreadsheet,
  ListSources,
  ReceiveAutodeskEvent,
  ReceiveNotice,
  SubscribeSource,
  UnlinkSource,
  UnsubscribeSource,
  WatchSource,
} from '@team27/context-integrations';
import {
  GoogleDriveWatcher,
  GoogleOAuthClient,
  GoogleSheetsReader,
  InMemorySnapshotCache,
  PrismaAutodeskEventRepository,
  PrismaConnectionRepository,
  PrismaSourceLinkRepository,
  TokenCipher,
} from '@team27/context-integrations/adapters';
import type { PrismaClient } from '@team27/data-main';

import { provideUseCase } from '../../common/provide-use-case.ts';
import type { Env } from '../../config/index.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { AccountsModule } from '../accounts/accounts.module.ts';
import { AutodeskWebhooksController } from './autodesk-webhooks.controller.ts';
import {
  AUTODESK_CHANGE_LISTENER,
  AUTODESK_EVENT_REPOSITORY,
  AUTODESK_WEBHOOKS_CONFIG,
  type AutodeskWebhooksConfig,
  AutodeskWebhooksService,
  CONNECTORS_LOGGER,
  type ConnectorsLogger,
} from './autodesk-webhooks.service.ts';
import {
  LoggingAutodeskListener,
  LoggingChangeListener,
} from './change-log.ts';
import { ConnectorsController } from './connectors.controller.ts';
import {
  GOOGLE_SETUP,
  type GoogleSetup,
  INTEGRATIONS_CONFIG,
  type IntegrationsConfig,
  IntegrationsService,
  type PushConfig,
} from './integrations.service.ts';
import { OAuthStates } from './oauth-states.ts';

const HOUR_MS = 3_600_000;

export const DEBOUNCE_MS = 2_000;

export const pushConfig = (env: {
  readonly webhookUrl: string | undefined;
  readonly watchHours: number;
  readonly fallbackSeconds: number;
}): PushConfig | null =>
  env.webhookUrl === undefined
    ? null
    : {
        address: env.webhookUrl,
        ttlMs: env.watchHours * HOUR_MS,
        renewMarginMs: Math.min(2 * HOUR_MS, (env.watchHours * HOUR_MS) / 4),
        fallbackMs: env.fallbackSeconds * 1000,
        debounceMs: DEBOUNCE_MS,
      };

export const buildGoogleSetup = (
  env: {
    readonly clientId: string | undefined;
    readonly clientSecret: string | undefined;
    readonly encryptionKey: string | undefined;
    readonly redirectUri: string;
  },
  prisma: PrismaClient,
): GoogleSetup | null => {
  const { clientId, clientSecret, encryptionKey, redirectUri } = env;
  if (!clientId || !clientSecret || !encryptionKey) return null;
  const authorizer = new GoogleOAuthClient({
    clientId,
    clientSecret,
    redirectUri,
  });
  const connections = new PrismaConnectionRepository(
    prisma,
    new TokenCipher(encryptionKey),
  );
  const sources = new PrismaSourceLinkRepository(prisma);
  const reader = new GoogleSheetsReader();
  const snapshots = new InMemorySnapshotCache();
  const listener = new LoggingChangeListener(new Logger('Conectores'));
  const drive = new GoogleDriveWatcher();
  return {
    connect: new ConnectGoogle(authorizer, connections),
    disconnect: new DisconnectGoogle(connections),
    connection: new GetGoogleConnection(connections),
    link: new LinkSpreadsheet(
      connections,
      authorizer,
      reader,
      sources,
      snapshots,
    ),
    unlink: new UnlinkSource(sources, snapshots),
    list: new ListSources(sources),
    watch: new WatchSource(
      connections,
      authorizer,
      reader,
      sources,
      snapshots,
      listener,
      () => new Date(),
      drive,
    ),
    push: {
      subscribe: new SubscribeSource(connections, authorizer, drive, sources),
      unsubscribe: new UnsubscribeSource(
        connections,
        authorizer,
        drive,
        sources,
      ),
      receive: new ReceiveNotice(sources),
    },
  };
};

@Module({
  imports: [AccountsModule],
  controllers: [ConnectorsController, AutodeskWebhooksController],
  providers: [
    { provide: OAuthStates, useFactory: () => new OAuthStates() },
    { provide: CONNECTORS_LOGGER, useFactory: () => new Logger('Conectores') },
    {
      provide: AUTODESK_EVENT_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) =>
        new PrismaAutodeskEventRepository(prisma),
    },
    {
      provide: AUTODESK_CHANGE_LISTENER,
      inject: [CONNECTORS_LOGGER],
      useFactory: (logger: ConnectorsLogger) =>
        new LoggingAutodeskListener(logger),
    },
    provideUseCase(ReceiveAutodeskEvent, [
      AUTODESK_EVENT_REPOSITORY,
      AUTODESK_CHANGE_LISTENER,
    ]),
    {
      provide: AUTODESK_WEBHOOKS_CONFIG,
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<Env, true>,
      ): AutodeskWebhooksConfig => ({
        secret: config.get('APS_WEBHOOK_SECRET', { infer: true }) ?? null,
      }),
    },
    AutodeskWebhooksService,
    {
      provide: INTEGRATIONS_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): IntegrationsConfig => ({
        pollMs: config.get('INTEGRATIONS_POLL_SECONDS', { infer: true }) * 1000,
        redirectUri: config.get('GOOGLE_REDIRECT_URI', { infer: true }),
        push: pushConfig({
          webhookUrl: config.get('GOOGLE_WEBHOOK_URL', { infer: true }),
          watchHours: config.get('INTEGRATIONS_WATCH_HOURS', { infer: true }),
          fallbackSeconds: config.get('INTEGRATIONS_FALLBACK_SECONDS', {
            infer: true,
          }),
        }),
      }),
    },
    {
      provide: GOOGLE_SETUP,
      inject: [ConfigService, PRISMA_CLIENT],
      useFactory: (config: ConfigService<Env, true>, prisma: PrismaClient) =>
        buildGoogleSetup(
          {
            clientId: config.get('GOOGLE_CLIENT_ID', { infer: true }),
            clientSecret: config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
            encryptionKey: config.get('INTEGRATIONS_ENCRYPTION_KEY', {
              infer: true,
            }),
            redirectUri: config.get('GOOGLE_REDIRECT_URI', { infer: true }),
          },
          prisma,
        ),
    },
    IntegrationsService,
  ],
})
export class IntegrationsModule {}
