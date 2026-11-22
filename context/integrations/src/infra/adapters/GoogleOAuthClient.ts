import { ProviderError } from '../../application/errors.ts';
import type { AccountAuthorizer } from '../../application/ports/index.ts';
import type { AccountGrant } from '../../domain/Connection.ts';
import { DRIVE_METADATA_SCOPE } from '../../domain/Push.ts';

export const SHEETS_READ_SCOPE =
  'https://www.googleapis.com/auth/spreadsheets.readonly';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  SHEETS_READ_SCOPE,
  DRIVE_METADATA_SCOPE,
] as const;

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REFRESH_MARGIN_MS = 60_000;

export interface GoogleOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export interface GoogleClientOptions {
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
}

interface TokenResponse {
  readonly access_token?: string;
  readonly expires_in?: number;
  readonly refresh_token?: string;
  readonly scope?: string;
  readonly id_token?: string;
  readonly error?: string;
}

interface CachedToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

export const emailFromIdToken = (
  idToken: string | undefined,
): string | null => {
  const payload = idToken?.split('.')[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    if (claims && typeof claims === 'object' && 'email' in claims) {
      return typeof claims.email === 'string' ? claims.email : null;
    }
    return null;
  } catch {
    return null;
  }
};

export class GoogleOAuthClient implements AccountAuthorizer {
  private readonly config: GoogleOAuthConfig;
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private readonly cache = new Map<string, CachedToken>();

  constructor(config: GoogleOAuthConfig, options: GoogleClientOptions = {}) {
    this.config = config;
    this.fetch = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  authorizationUrl(state: string): string {
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    }).toString();
    return url.toString();
  }

  async exchange(code: string): Promise<AccountGrant> {
    const body = await this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
    });
    if (!body.refresh_token) {
      throw new ProviderError(
        'Google no entregó un permiso permanente: vuelve a conectar la cuenta',
      );
    }
    const accountEmail = emailFromIdToken(body.id_token);
    if (accountEmail === null) {
      throw new ProviderError('Google no dijo de qué cuenta es el permiso');
    }
    const scopes = (body.scope ?? '').split(' ').filter(Boolean);
    if (!scopes.includes(SHEETS_READ_SCOPE)) {
      throw new ProviderError(
        'Falta el permiso para leer tus planillas: acéptalo al conectar la cuenta',
      );
    }
    this.remember(body.refresh_token, body);
    return { accountEmail, scopes, refreshToken: body.refresh_token };
  }

  async accessToken(refreshToken: string): Promise<string> {
    const cached = this.cache.get(refreshToken);
    if (cached && cached.expiresAt - REFRESH_MARGIN_MS > this.now()) {
      return cached.accessToken;
    }
    const body = await this.token({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    return this.remember(refreshToken, body);
  }

  private remember(refreshToken: string, body: TokenResponse): string {
    if (!body.access_token) {
      throw new ProviderError('Google no entregó un token de acceso');
    }
    this.cache.set(refreshToken, {
      accessToken: body.access_token,
      expiresAt: this.now() + (body.expires_in ?? 0) * 1000,
    });
    return body.access_token;
  }

  private async token(params: Record<string, string>): Promise<TokenResponse> {
    let response: Response;
    try {
      response = await this.fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          ...params,
        }).toString(),
      });
    } catch {
      throw new ProviderError('No pudimos hablar con Google');
    }
    const body = (await response.json().catch(() => ({}))) as TokenResponse;
    if (!response.ok) {
      throw new ProviderError(
        body.error === 'invalid_grant'
          ? 'Google revocó o venció el permiso: vuelve a conectar la cuenta'
          : `Google rechazó el pedido de permiso (${body.error ?? response.status})`,
        response.status,
      );
    }
    return body;
  }
}
