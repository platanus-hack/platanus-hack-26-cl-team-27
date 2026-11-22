export const CONNECTION_STATUSES = ['active', 'reconnect_required'] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export interface ApsTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

export interface AutodeskUser {
  readonly id: string;
  readonly email: string | null;
  readonly name: string | null;
}

export interface StoredConnection {
  readonly organizationId: string;
  readonly connectedById: string | null;
  readonly autodeskUser: AutodeskUser;
  readonly scopes: readonly string[];
  readonly tokens: ApsTokens | null;
  readonly refreshedAt: Date;
  readonly status: ConnectionStatus;
  readonly createdAt: Date;
}

export type NewConnection = Omit<
  StoredConnection,
  'createdAt' | 'status' | 'tokens'
> & { readonly tokens: ApsTokens };

export interface TokenVault {
  find(organizationId: string): Promise<StoredConnection | null>;
  save(connection: NewConnection): Promise<void>;
  storeTokens(
    organizationId: string,
    tokens: ApsTokens,
    refreshedAt: Date,
  ): Promise<void>;
  markReconnectRequired(organizationId: string): Promise<void>;
  remove(organizationId: string): Promise<void>;
  activeRefreshedBefore(date: Date): Promise<readonly string[]>;
}
