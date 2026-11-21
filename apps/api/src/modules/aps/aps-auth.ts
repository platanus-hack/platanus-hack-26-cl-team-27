import { AuthenticationClient, type Scopes } from '@aps_sdk/authentication';

export interface ApsToken {
  readonly access_token: string;
  readonly expires_in: number;
}

export interface ApsCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

interface CachedToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

export const VIEWER_SCOPES: readonly Scopes[] = ['viewables:read'];

export const INTERNAL_SCOPES: readonly Scopes[] = [
  'bucket:create',
  'bucket:read',
  'data:read',
  'data:write',
  'data:create',
];

const REFRESH_MARGIN_MS = 60_000;

export class ApsAuth {
  private readonly credentials: ApsCredentials;
  private readonly client: AuthenticationClient;
  private readonly now: () => number;
  private readonly cache = new Map<string, CachedToken>();
  private readonly pending = new Map<string, Promise<CachedToken>>();

  constructor(
    credentials: ApsCredentials,
    options: { client?: AuthenticationClient; now?: () => number } = {},
  ) {
    this.credentials = credentials;
    this.client = options.client ?? new AuthenticationClient();
    this.now = options.now ?? Date.now;
  }

  async getToken(scopes: readonly Scopes[]): Promise<ApsToken> {
    const key = [...scopes].sort().join(' ');
    const cached = this.cache.get(key);
    const token =
      cached && cached.expiresAt - REFRESH_MARGIN_MS > this.now()
        ? cached
        : await this.request(key, scopes);
    return {
      access_token: token.accessToken,
      expires_in: Math.max(
        0,
        Math.floor((token.expiresAt - this.now()) / 1000),
      ),
    };
  }

  asProvider(scopes: readonly Scopes[]): {
    getAccessToken: () => Promise<string>;
  } {
    return {
      getAccessToken: async () => (await this.getToken(scopes)).access_token,
    };
  }

  private request(
    key: string,
    scopes: readonly Scopes[],
  ): Promise<CachedToken> {
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    const promise = this.client
      .getTwoLeggedToken(
        this.credentials.clientId,
        this.credentials.clientSecret,
        [...scopes],
      )
      .then((token) => {
        const cached = {
          accessToken: token.access_token,
          expiresAt: this.now() + token.expires_in * 1000,
        };
        this.cache.set(key, cached);
        return cached;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
}

export const apsErrorStatus = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as {
    httpStatusCode?: () => number | null;
    axiosError?: { response?: { status?: number } };
  };
  if (typeof candidate.httpStatusCode === 'function') {
    return candidate.httpStatusCode();
  }
  return candidate.axiosError?.response?.status ?? null;
};

export const readApsCredentials = (
  env: Readonly<Record<string, string | undefined>>,
): ApsCredentials | null => {
  const clientId = env['APS_CLIENT_ID']?.trim();
  const clientSecret = env['APS_CLIENT_SECRET']?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};
