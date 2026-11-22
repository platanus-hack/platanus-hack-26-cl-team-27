export const PROVIDERS = ['google'] as const;

export type Provider = (typeof PROVIDERS)[number];

export interface Connection {
  readonly id: string;
  readonly userId: string;
  readonly provider: Provider;
  readonly accountEmail: string;
  readonly scopes: readonly string[];
  readonly connectedAt: Date;
}

export interface AccountGrant {
  readonly accountEmail: string;
  readonly scopes: readonly string[];
  readonly refreshToken: string;
}

export interface ConnectionGrant extends AccountGrant {
  readonly userId: string;
  readonly provider: Provider;
}

export interface SourceError {
  readonly at: Date;
  readonly message: string;
}

export interface SourceLink {
  readonly id: string;
  readonly projectId: string;
  readonly connectionId: string | null;
  readonly provider: Provider;
  readonly externalId: string;
  readonly title: string;
  readonly pointer: string;
  readonly contentHash: string | null;
  readonly checkedAt: Date | null;
  readonly changedAt: Date | null;
  readonly lastError: SourceError | null;
  readonly createdAt: Date;
}

export interface SourceLinkDraft {
  readonly projectId: string;
  readonly connectionId: string;
  readonly provider: Provider;
  readonly externalId: string;
  readonly title: string;
  readonly pointer: string;
  readonly contentHash: string;
  readonly checkedAt: Date;
}

export interface SourceCheck {
  readonly at: Date;
  readonly title: string;
  readonly contentHash: string;
  readonly changed: boolean;
}

export interface SourceRelink {
  readonly connectionId: string;
  readonly at: Date;
  readonly title: string;
  readonly contentHash: string;
}
