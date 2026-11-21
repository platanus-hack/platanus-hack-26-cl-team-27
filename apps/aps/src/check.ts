import { AuthenticationClient } from '@aps_sdk/authentication';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';
import { OssClient } from '@aps_sdk/oss';

import { apsErrorStatus } from './aps-errors.ts';
import type { ApsConfig } from './config.ts';
import type { Output } from './io.ts';
import { tokenProvider } from './token.ts';

export interface CheckClients {
  readonly auth: Pick<AuthenticationClient, 'getTwoLeggedToken'>;
  readonly oss: Pick<OssClient, 'getBucketDetails'>;
}

const defaultClients = (config: ApsConfig): CheckClients => {
  const sdkManager = SdkManagerBuilder.create().build();
  sdkManager.toggleLogging(false);
  return {
    auth: new AuthenticationClient(),
    oss: new OssClient({
      sdkManager,
      authenticationProvider: tokenProvider(config, ['bucket:read']),
    }),
  };
};

export const check = async (
  config: ApsConfig,
  io: Output,
  clients: CheckClients = defaultClients(config),
): Promise<number> => {
  try {
    const token = await clients.auth.getTwoLeggedToken(
      config.clientId,
      config.clientSecret,
      ['viewables:read'],
    );
    io.out(
      `APS: credenciales válidas (HTTP 200, el token dura ${token.expires_in} s).`,
    );
  } catch (error) {
    io.err(
      `APS: credenciales rechazadas (HTTP ${apsErrorStatus(error) ?? 'sin respuesta'}).`,
    );
    return 1;
  }
  try {
    await clients.oss.getBucketDetails(config.bucketKey);
    io.out(`Bucket ${config.bucketKey}: lo ve esta app.`);
    return 0;
  } catch (error) {
    const status = apsErrorStatus(error);
    if (status === 404) {
      io.err(`Bucket ${config.bucketKey}: no existe; pnpm aps:models lo crea.`);
    } else if (status === 403) {
      io.err(
        `Bucket ${config.bucketKey}: es de otra app de APS; usa sus credenciales o cambia APS_BUCKET_KEY.`,
      );
    } else {
      io.err(
        `Bucket ${config.bucketKey}: APS no respondió (HTTP ${status ?? 'sin respuesta'}).`,
      );
    }
    return 1;
  }
};
