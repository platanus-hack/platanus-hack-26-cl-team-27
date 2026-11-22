import { AuthenticationClient, type Scopes } from '@aps_sdk/authentication';

import { apsErrorStatus } from '../../aps/aps-auth.ts';
import type { AutodeskUser } from './token-vault.ts';

export const CONNECTION_SCOPES: readonly Scopes[] = [
  'data:read',
  'account:read',
  'user-profile:read',
];

export interface ApsGrant {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresIn: number;
}

export class GrantRejectedError extends Error {
  readonly status: number | null;

  constructor(status: number | null) {
    super(`APS rechazó la autorización (HTTP ${status ?? '?'})`);
    this.name = 'GrantRejectedError';
    this.status = status;
  }
}

export interface ApsOAuthClient {
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<ApsGrant>;
  refresh(refreshToken: string): Promise<ApsGrant>;
  profile(accessToken: string): Promise<AutodeskUser>;
  revoke(refreshToken: string): Promise<void>;
}

export interface ApsOAuthSettings {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly callbackUrl: string;
}

type SdkClient = Pick<
  AuthenticationClient,
  | 'authorize'
  | 'getThreeLeggedToken'
  | 'refreshToken'
  | 'getUserInfo'
  | 'revoke'
>;

const REJECTED_STATUSES = new Set([400, 401, 403]);

const toGrant = (token: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}): ApsGrant => ({
  accessToken: token.access_token,
  refreshToken: token.refresh_token || null,
  expiresIn: token.expires_in,
});

const translate = (error: unknown): Error => {
  const status = apsErrorStatus(error);
  return status !== null && REJECTED_STATUSES.has(status)
    ? new GrantRejectedError(status)
    : error instanceof Error
      ? error
      : new Error('APS no respondió');
};

export class SdkApsOAuthClient implements ApsOAuthClient {
  private readonly settings: ApsOAuthSettings;
  private readonly client: SdkClient;

  constructor(settings: ApsOAuthSettings, client?: SdkClient) {
    this.settings = settings;
    this.client = client ?? new AuthenticationClient();
  }

  authorizeUrl(state: string): string {
    return this.client.authorize(
      this.settings.clientId,
      'code',
      this.settings.callbackUrl,
      [...CONNECTION_SCOPES],
      { state },
    );
  }

  async exchangeCode(code: string): Promise<ApsGrant> {
    try {
      return toGrant(
        await this.client.getThreeLeggedToken(
          this.settings.clientId,
          code,
          this.settings.callbackUrl,
          { clientSecret: this.settings.clientSecret },
        ),
      );
    } catch (error) {
      throw translate(error);
    }
  }

  async refresh(refreshToken: string): Promise<ApsGrant> {
    try {
      return toGrant(
        await this.client.refreshToken(refreshToken, this.settings.clientId, {
          clientSecret: this.settings.clientSecret,
          scopes: [...CONNECTION_SCOPES],
        }),
      );
    } catch (error) {
      throw translate(error);
    }
  }

  async profile(accessToken: string): Promise<AutodeskUser> {
    const info = await this.client.getUserInfo(`Bearer ${accessToken}`);
    if (!info.sub) throw new Error('APS no entregó el usuario');
    return {
      id: info.sub,
      email: info.email ?? null,
      name: info.name ?? info.preferred_username ?? null,
    };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.client.revoke(
      refreshToken,
      this.settings.clientId,
      'refresh_token',
      { clientSecret: this.settings.clientSecret },
    );
  }
}
