import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectGoogle,
  DisconnectGoogle,
  GetGoogleConnection,
  LinkSpreadsheet,
  ListSources,
  UnlinkSource,
  WatchSource,
} from '@team27/context-integrations';
import {
  GoogleOAuthClient,
  GoogleSheetsReader,
  InMemorySnapshotCache,
  PrismaConnectionRepository,
  PrismaSourceLinkRepository,
  TokenCipher,
} from '@team27/context-integrations/adapters';
import type { PrismaClient } from '@team27/data-main';

import type { Env } from '../../config/index.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { AccountsModule } from '../accounts/accounts.module.ts';
import { LoggingChangeListener } from './change-log.ts';
import { ConnectorsController } from './connectors.controller.ts';
import {
  GOOGLE_SETUP,
  type GoogleSetup,
  INTEGRATIONS_CONFIG,
  type IntegrationsConfig,
  IntegrationsService,
} from './integrations.service.ts';
import { OAuthStates } from './oauth-states.ts';

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
    ),
  };
};

@Module({
  imports: [AccountsModule],
  controllers: [ConnectorsController],
  providers: [
    { provide: OAuthStates, useFactory: () => new OAuthStates() },
    {
      provide: INTEGRATIONS_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): IntegrationsConfig => ({
        pollMs: config.get('INTEGRATIONS_POLL_SECONDS', { infer: true }) * 1000,
        redirectUri: config.get('GOOGLE_REDIRECT_URI', { infer: true }),
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
