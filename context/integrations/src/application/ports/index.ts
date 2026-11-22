import type {
  AccountGrant,
  Connection,
  ConnectionGrant,
  Provider,
  SourceCheck,
  SourceError,
  SourceLink,
  SourceLinkDraft,
} from '../../domain/Connection.ts';
import type { CellChange, SheetSnapshot } from '../../domain/Sheet.ts';

export interface StoredConnection extends Connection {
  readonly refreshToken: string;
}

export interface ConnectionRepository {
  find(provider: Provider): Promise<StoredConnection | null>;
  save(grant: ConnectionGrant): Promise<Connection>;
  remove(provider: Provider): Promise<boolean>;
}

export interface SourceLinkRepository {
  list(): Promise<SourceLink[]>;
  find(id: string): Promise<SourceLink | null>;
  findByExternalId(externalId: string): Promise<SourceLink | null>;
  create(draft: SourceLinkDraft): Promise<SourceLink>;
  recordCheck(id: string, check: SourceCheck): Promise<SourceLink>;
  recordError(id: string, error: SourceError): Promise<SourceLink>;
  remove(id: string): Promise<boolean>;
}

export interface AccountAuthorizer {
  authorizationUrl(state: string): string;
  exchange(code: string): Promise<AccountGrant>;
  accessToken(refreshToken: string): Promise<string>;
}

export interface SpreadsheetContent extends SheetSnapshot {
  readonly title: string;
  readonly pointer: string;
  readonly contentHash: string;
}

export interface SpreadsheetReader {
  read(accessToken: string, spreadsheetId: string): Promise<SpreadsheetContent>;
}

export interface SnapshotCache {
  get(sourceId: string): SheetSnapshot | null;
  set(sourceId: string, snapshot: SheetSnapshot): void;
  delete(sourceId: string): void;
}

export interface SheetChange {
  readonly source: SourceLink;
  readonly at: Date;
  readonly cells: readonly CellChange[] | null;
}

export interface ChangeListener {
  changed(change: SheetChange): Promise<void>;
}
