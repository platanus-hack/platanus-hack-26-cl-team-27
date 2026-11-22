import {
  CONNECTION_SCOPES,
  GrantRejectedError,
  type ApsGrant,
  type ApsOAuthClient,
} from './aps-oauth-client.ts';
import {
  newNonce,
  openState,
  sameNonce,
  sealState,
  STATE_TTL_MS,
} from './oauth-state.ts';
import type { TokenCipher } from './token-cipher.ts';
import type {
  ApsTokens,
  AutodeskUser,
  ConnectionStatus,
  StoredConnection,
  TokenVault,
} from './token-vault.ts';

export const REFRESH_MARGIN_MS = 5 * 60_000;

export const IDLE_REFRESH_AFTER_MS = 7 * 24 * 60 * 60_000;

export const CONNECTION_ERRORS = [
  'invalid_state',
  'access_denied',
  'code_rejected',
  'not_connected',
  'reconnect_required',
  'aps_unavailable',
] as const;

export type ConnectionErrorCode = (typeof CONNECTION_ERRORS)[number];

export class ApsConnectionError extends Error {
  readonly code: ConnectionErrorCode;

  constructor(code: ConnectionErrorCode, message: string) {
    super(message);
    this.name = 'ApsConnectionError';
    this.code = code;
  }
}

export interface ConnectionView {
  readonly status: ConnectionStatus;
  readonly autodeskUser: AutodeskUser;
  readonly scopes: readonly string[];
  readonly connectedById: string | null;
  readonly connectedAt: string;
  readonly refreshedAt: string;
}

export interface AuthorizationStart {
  readonly url: string;
  readonly nonce: string;
}

export interface AuthorizationCallback {
  readonly state: string;
  readonly nonce: string | null;
  readonly code: string | null;
  readonly error: string | null;
}

export class ApsConnectionService {
  private readonly vault: TokenVault;
  private readonly client: ApsOAuthClient;
  private readonly cipher: TokenCipher;
  private readonly now: () => number;
  private readonly refreshing = new Map<string, Promise<string>>();

  constructor(
    vault: TokenVault,
    client: ApsOAuthClient,
    cipher: TokenCipher,
    options: { now?: () => number } = {},
  ) {
    this.vault = vault;
    this.client = client;
    this.cipher = cipher;
    this.now = options.now ?? Date.now;
  }

  startAuthorization(
    organizationId: string,
    userId: string,
  ): AuthorizationStart {
    const nonce = newNonce();
    const state = sealState(this.cipher, {
      organizationId,
      userId,
      nonce,
      expiresAt: this.now() + STATE_TTL_MS,
    });
    return { url: this.client.authorizeUrl(state), nonce };
  }

  async completeAuthorization(
    callback: AuthorizationCallback,
  ): Promise<{ organizationId: string }> {
    const state = openState(this.cipher, callback.state, this.now());
    if (!state || !callback.nonce || !sameNonce(state.nonce, callback.nonce)) {
      throw new ApsConnectionError(
        'invalid_state',
        'La autorización no partió desde este navegador o ya venció',
      );
    }
    const { code } = callback;
    if (callback.error || !code) {
      throw new ApsConnectionError(
        'access_denied',
        'No se autorizó el acceso a Autodesk',
      );
    }
    const grant = await this.call(
      () => this.client.exchangeCode(code),
      'code_rejected',
    );
    if (!grant.refreshToken) {
      throw new ApsConnectionError(
        'aps_unavailable',
        'APS no entregó el token de renovación',
      );
    }
    const autodeskUser = await this.call(
      () => this.client.profile(grant.accessToken),
      'aps_unavailable',
    );
    await this.vault.save({
      organizationId: state.organizationId,
      connectedById: state.userId,
      autodeskUser,
      scopes: [...CONNECTION_SCOPES],
      tokens: this.tokensOf(grant, grant.refreshToken),
      refreshedAt: new Date(this.now()),
    });
    return { organizationId: state.organizationId };
  }

  async status(organizationId: string): Promise<ConnectionView | null> {
    const connection = await this.vault.find(organizationId);
    if (!connection) return null;
    return {
      status: connection.status,
      autodeskUser: connection.autodeskUser,
      scopes: connection.scopes,
      connectedById: connection.connectedById,
      connectedAt: connection.createdAt.toISOString(),
      refreshedAt: connection.refreshedAt.toISOString(),
    };
  }

  async getValidAccessToken(organizationId: string): Promise<string> {
    const connection = await this.vault.find(organizationId);
    if (!connection) {
      throw new ApsConnectionError(
        'not_connected',
        'La organización no conectó su cuenta de Autodesk',
      );
    }
    const tokens = this.usableTokens(connection);
    if (tokens.expiresAt.getTime() - REFRESH_MARGIN_MS > this.now()) {
      return tokens.accessToken;
    }
    return this.refresh(organizationId, tokens.refreshToken);
  }

  async refreshIdle(): Promise<number> {
    const organizations = await this.vault.activeRefreshedBefore(
      new Date(this.now() - IDLE_REFRESH_AFTER_MS),
    );
    let refreshed = 0;
    for (const organizationId of organizations) {
      const connection = await this.vault.find(organizationId);
      if (!connection?.tokens || connection.status !== 'active') continue;
      try {
        await this.refresh(organizationId, connection.tokens.refreshToken);
        refreshed += 1;
      } catch (error) {
        if (!(error instanceof ApsConnectionError)) throw error;
      }
    }
    return refreshed;
  }

  async disconnect(organizationId: string): Promise<void> {
    const connection = await this.vault.find(organizationId);
    if (!connection) return;
    if (connection.tokens) {
      await this.client
        .revoke(connection.tokens.refreshToken)
        .catch(() => undefined);
    }
    await this.vault.remove(organizationId);
  }

  private usableTokens(connection: StoredConnection): ApsTokens {
    if (connection.status !== 'active' || !connection.tokens) {
      throw new ApsConnectionError(
        'reconnect_required',
        'Vuelve a conectar la cuenta de Autodesk',
      );
    }
    return connection.tokens;
  }

  private refresh(
    organizationId: string,
    refreshToken: string,
  ): Promise<string> {
    const inFlight = this.refreshing.get(organizationId);
    if (inFlight) return inFlight;
    const promise = this.renew(organizationId, refreshToken).finally(() =>
      this.refreshing.delete(organizationId),
    );
    this.refreshing.set(organizationId, promise);
    return promise;
  }

  private async renew(
    organizationId: string,
    refreshToken: string,
  ): Promise<string> {
    let grant: ApsGrant;
    try {
      grant = await this.client.refresh(refreshToken);
    } catch (error) {
      if (error instanceof GrantRejectedError) {
        await this.vault.markReconnectRequired(organizationId);
        throw new ApsConnectionError(
          'reconnect_required',
          'Autodesk ya no acepta la conexión: vuelve a conectarla',
        );
      }
      throw new ApsConnectionError('aps_unavailable', 'APS no renovó el token');
    }
    const tokens = this.tokensOf(grant, grant.refreshToken ?? refreshToken);
    await this.vault.storeTokens(organizationId, tokens, new Date(this.now()));
    return tokens.accessToken;
  }

  private tokensOf(grant: ApsGrant, refreshToken: string): ApsTokens {
    return {
      accessToken: grant.accessToken,
      refreshToken,
      expiresAt: new Date(this.now() + grant.expiresIn * 1000),
    };
  }

  private async call<T>(
    action: () => Promise<T>,
    rejected: ConnectionErrorCode,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw error instanceof GrantRejectedError
        ? new ApsConnectionError(rejected, 'Autodesk rechazó la autorización')
        : new ApsConnectionError('aps_unavailable', 'APS no respondió');
    }
  }
}
