import type {
  AccountGrant,
  Connection,
  ConnectionGrant,
  Provider,
  SourceError,
  SourceLink,
  SourceLinkDraft,
  SourceRead,
} from '../../domain/Connection.ts';
import type { SourceChunk } from '../../domain/readBudgetSheet.ts';
import type { SheetTab } from '../../domain/Sheet.ts';

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
  findByDocument(documentId: string): Promise<SourceLink | null>;
  create(draft: SourceLinkDraft): Promise<SourceLink>;
  recordCheck(id: string, at: Date, title: string): Promise<SourceLink>;
  recordRead(id: string, read: SourceRead, title: string): Promise<SourceLink>;
  recordError(id: string, error: SourceError): Promise<SourceLink>;
  remove(id: string): Promise<boolean>;
}

export interface AccountAuthorizer {
  authorizationUrl(state: string): string;
  exchange(code: string): Promise<AccountGrant>;
  accessToken(refreshToken: string): Promise<string>;
}

export interface SpreadsheetSnapshot {
  readonly title: string;
  readonly tab: SheetTab;
  readonly pointer: string;
  readonly contentHash: string;
}

export interface SpreadsheetReader {
  read(
    accessToken: string,
    spreadsheetId: string,
  ): Promise<SpreadsheetSnapshot>;
}

export interface RevisionDelivery {
  readonly documentId: string;
  readonly label: string;
  readonly pointer: string;
  readonly contentHash: string;
  readonly chunks: readonly SourceChunk[];
}

export interface DeliveryReceipt {
  readonly revisionId: string;
  readonly proposals: number;
  readonly summary: string;
}

export interface RevisionSink {
  epoch(): Promise<number | null>;
  deliver(delivery: RevisionDelivery): Promise<DeliveryReceipt>;
}
