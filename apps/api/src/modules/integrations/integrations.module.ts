import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectGoogle,
  DisconnectGoogle,
  GetGoogleConnection,
  LinkSpreadsheet,
  ListSources,
  SyncSource,
  UnlinkSource,
} from '@team27/context-integrations';
import {
  GoogleOAuthClient,
  GoogleSheetsReader,
  PrismaConnectionRepository,
  PrismaSourceLinkRepository,
  TokenCipher,
} from '@team27/context-integrations/adapters';
import type { PrismaClient } from '@team27/data-main';

import type { Env } from '../../config/index.ts';
import { CoordinationModule } from '../coordination/coordination.module.ts';
import { CoordinationService } from '../coordination/coordination.service.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { RoomStoreModule } from '../room/store.module.ts';
import { ConnectorsController } from './connectors.controller.ts';
import {
  GOOGLE_SETUP,
  type GoogleSetup,
  INTEGRATIONS_CONFIG,
  type IntegrationsConfig,
  IntegrationsService,
} from './integrations.service.ts';
import { OAuthStates } from './oauth-states.ts';
import { CoordinationRevisionSink } from './revision-sink.ts';
import { buildSourceVocabulary } from './vocabulary.ts';

export const buildGoogleSetup = (
  env: {
    readonly clientId: string | undefined;
    readonly clientSecret: string | undefined;
    readonly encryptionKey: string | undefined;
    readonly redirectUri: string;
  },
  prisma: PrismaClient,
  coordination: CoordinationService,
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
  return {
    connect: new ConnectGoogle(authorizer, connections),
    disconnect: new DisconnectGoogle(connections),
    connection: new GetGoogleConnection(connections),
    link: new LinkSpreadsheet(connections, authorizer, reader, sources),
    unlink: new UnlinkSource(sources),
    list: new ListSources(sources),
    sync: new SyncSource(
      connections,
      authorizer,
      reader,
      sources,
      new CoordinationRevisionSink(prisma, coordination),
      buildSourceVocabulary(),
    ),
  };
};

@Module({
  imports: [CoordinationModule, RoomStoreModule],
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
      inject: [ConfigService, PRISMA_CLIENT, CoordinationService],
      useFactory: (
        config: ConfigService<Env, true>,
        prisma: PrismaClient,
        coordination: CoordinationService,
      ) =>
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
          coordination,
        ),
    },
    IntegrationsService,
  ],
})
export class IntegrationsModule {}
