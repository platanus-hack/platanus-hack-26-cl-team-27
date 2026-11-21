import type { IgnoredCell } from './readBudgetSheet.ts';

export const PROVIDERS = ['google'] as const;

export type Provider = (typeof PROVIDERS)[number];

export interface Connection {
  readonly id: string;
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
  readonly provider: Provider;
}

export interface SourceRead {
  readonly at: Date;
  readonly hash: string;
  readonly epoch: number;
  readonly label: string;
  readonly ignored: readonly IgnoredCell[];
}

export interface SourceError {
  readonly at: Date;
  readonly message: string;
}

export interface SourceLink {
  readonly id: string;
  readonly connectionId: string;
  readonly provider: Provider;
  readonly externalId: string;
  readonly documentId: string;
  readonly title: string;
  readonly pointer: string;
  readonly checkedAt: Date | null;
  readonly lastRead: SourceRead | null;
  readonly lastError: SourceError | null;
  readonly createdAt: Date;
}

export interface SourceLinkDraft {
  readonly connectionId: string;
  readonly provider: Provider;
  readonly externalId: string;
  readonly documentId: string;
  readonly title: string;
  readonly pointer: string;
}
