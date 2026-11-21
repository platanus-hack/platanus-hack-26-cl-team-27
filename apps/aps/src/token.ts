import { AuthenticationClient, type Scopes } from '@aps_sdk/authentication';

import type { ApsCredentials } from './config.ts';

const REFRESH_MARGIN_MS = 60_000;

export interface TokenProvider {
  getAccessToken(): Promise<string>;
}

export const tokenProvider = (
  credentials: ApsCredentials,
  scopes: readonly Scopes[],
  options: {
    client?: Pick<AuthenticationClient, 'getTwoLeggedToken'>;
    now?: () => number;
  } = {},
): TokenProvider => {
  const client = options.client ?? new AuthenticationClient();
  const now = options.now ?? Date.now;
  let cached: {
    readonly accessToken: string;
    readonly expiresAt: number;
  } | null = null;
  let pending: Promise<string> | null = null;
  return {
    getAccessToken: () => {
      if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now()) {
        return Promise.resolve(cached.accessToken);
      }
      pending ??= client
        .getTwoLeggedToken(credentials.clientId, credentials.clientSecret, [
          ...scopes,
        ])
        .then((token) => {
          cached = {
            accessToken: token.access_token,
            expiresAt: now() + token.expires_in * 1000,
          };
          return token.access_token;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
  };
};
