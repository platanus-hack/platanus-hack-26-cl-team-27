import type {
  ApsGrant,
  ApsOAuthClient,
} from '../../../../src/modules/integrations/aps/aps-oauth-client.ts';
import { TokenCipher } from '../../../../src/modules/integrations/aps/token-cipher.ts';
import type {
  ApsTokens,
  NewConnection,
  StoredConnection,
  TokenVault,
} from '../../../../src/modules/integrations/aps/token-vault.ts';

export const KEY = 'a'.repeat(64);

export const cipher = () => new TokenCipher(KEY);

export class MemoryVault implements TokenVault {
  readonly rows = new Map<string, StoredConnection>();

  find(organizationId: string) {
    return Promise.resolve(this.rows.get(organizationId) ?? null);
  }

  save(connection: NewConnection) {
    const previous = this.rows.get(connection.organizationId);
    this.rows.set(connection.organizationId, {
      ...connection,
      status: 'active',
      createdAt: previous?.createdAt ?? new Date(0),
    });
    return Promise.resolve();
  }

  storeTokens(organizationId: string, tokens: ApsTokens, refreshedAt: Date) {
    const row = this.rows.get(organizationId);
    if (!row) throw new Error('sin conexión');
    this.rows.set(organizationId, {
      ...row,
      tokens,
      refreshedAt,
      status: 'active',
    });
    return Promise.resolve();
  }

  markReconnectRequired(organizationId: string) {
    const row = this.rows.get(organizationId);
    if (row)
      this.rows.set(organizationId, { ...row, status: 'reconnect_required' });
    return Promise.resolve();
  }

  remove(organizationId: string) {
    this.rows.delete(organizationId);
    return Promise.resolve();
  }

  activeRefreshedBefore(date: Date) {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((row) => row.status === 'active' && row.refreshedAt < date)
        .map((row) => row.organizationId),
    );
  }
}

export const grant = (n: number, expiresIn = 3600): ApsGrant => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  expiresIn,
});

export const fakeClient = () => {
  let issued = 0;
  const client = {
    authorizeUrl: vi.fn(
      (state: string) =>
        `https://developer.api.autodesk.com/authentication/v2/authorize?state=${encodeURIComponent(state)}`,
    ),
    exchangeCode: vi.fn<ApsOAuthClient['exchangeCode']>(async () =>
      grant(++issued),
    ),
    refresh: vi.fn<ApsOAuthClient['refresh']>(async () => grant(++issued)),
    profile: vi.fn<ApsOAuthClient['profile']>(async () => ({
      id: 'autodesk-1',
      email: 'admin@aromos.cl',
      name: 'Fernanda Soto',
    })),
    revoke: vi.fn<ApsOAuthClient['revoke']>(async () => undefined),
  } satisfies ApsOAuthClient;
  return client;
};

export const stateOf = (url: string): string => {
  const state = new URL(url).searchParams.get('state');
  if (!state) throw new Error('sin state');
  return state;
};
