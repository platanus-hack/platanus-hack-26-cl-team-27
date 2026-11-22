import {
  Inject,
  Logger,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@team27/data-main';

import type { Env } from '../../../config/index.ts';
import { AccountsModule } from '../../accounts/accounts.module.ts';
import { PRISMA_CLIENT } from '../../database/database.module.ts';
import { ApsConnectionController } from './aps-connection.controller.ts';
import { ApsConnectionService } from './aps-connection.service.ts';
import {
  APS_CONNECTIONS,
  type ApsConnections,
} from './aps-connection.tokens.ts';
import { SdkApsOAuthClient } from './aps-oauth-client.ts';
import { PrismaTokenVault } from './prisma-token-vault.ts';
import { TokenCipher } from './token-cipher.ts';

export const IDLE_SWEEP_INTERVAL_MS = 6 * 60 * 60_000;

export const createApsConnections = (
  env: Pick<
    Env,
    'APS_CLIENT_ID' | 'APS_CLIENT_SECRET' | 'APS_CALLBACK_URL' | 'APS_TOKEN_KEY'
  >,
  prisma: Pick<PrismaClient, 'apsConnection'>,
): ApsConnections | null => {
  const {
    APS_CLIENT_ID: clientId,
    APS_CLIENT_SECRET: clientSecret,
    APS_CALLBACK_URL: callbackUrl,
    APS_TOKEN_KEY: tokenKey,
  } = env;
  if (!clientId || !clientSecret || !callbackUrl || !tokenKey) return null;
  const cipher = new TokenCipher(tokenKey);
  const service = new ApsConnectionService(
    new PrismaTokenVault(prisma, cipher),
    new SdkApsOAuthClient({ clientId, clientSecret, callbackUrl }),
    cipher,
  );
  return { service, callbackUrl };
};

@Module({
  imports: [AccountsModule],
  controllers: [ApsConnectionController],
  providers: [
    {
      provide: APS_CONNECTIONS,
      inject: [ConfigService, PRISMA_CLIENT],
      useFactory: (config: ConfigService<Env, true>, prisma: PrismaClient) =>
        createApsConnections(
          {
            APS_CLIENT_ID: config.get('APS_CLIENT_ID', { infer: true }),
            APS_CLIENT_SECRET: config.get('APS_CLIENT_SECRET', { infer: true }),
            APS_CALLBACK_URL: config.get('APS_CALLBACK_URL', { infer: true }),
            APS_TOKEN_KEY: config.get('APS_TOKEN_KEY', { infer: true }),
          },
          prisma,
        ),
    },
  ],
  exports: [APS_CONNECTIONS],
})
export class ApsConnectionModule
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ApsConnectionModule.name);
  private readonly connections: ApsConnections | null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(APS_CONNECTIONS) connections: ApsConnections | null) {
    this.connections = connections;
  }

  onApplicationBootstrap(): void {
    const connections = this.connections;
    if (!connections) return;
    this.timer = setInterval(() => {
      connections.service.refreshIdle().catch((error: unknown) => {
        this.logger.error(
          `No se renovaron las conexiones de Autodesk: ${error instanceof Error ? error.message : 'error'}`,
        );
      });
    }, IDLE_SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
