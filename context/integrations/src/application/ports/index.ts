import type {
  AccountGrant,
  Connection,
  ConnectionGrant,
  Provider,
  SourceCheck,
  SourceError,
  SourceLink,
  SourceLinkDraft,
  SourceRelink,
} from '../../domain/Connection.ts';
import type { AutodeskChange } from '../../domain/autodesk/AutodeskChange.ts';
import type { Editor, PushChannel } from '../../domain/Push.ts';
import type { CellChange, SheetSnapshot } from '../../domain/Sheet.ts';

export interface StoredConnection extends Connection {
  readonly refreshToken: string;
}

export interface ConnectionRepository {
  findForUser(
    userId: string,
    provider: Provider,
  ): Promise<StoredConnection | null>;
  find(id: string): Promise<StoredConnection | null>;
  save(grant: ConnectionGrant): Promise<Connection>;
  remove(userId: string, provider: Provider): Promise<boolean>;
}

export interface SourceLinkRepository {
  list(projectId?: string): Promise<SourceLink[]>;
  find(id: string): Promise<SourceLink | null>;
  findInProject(
    projectId: string,
    externalId: string,
  ): Promise<SourceLink | null>;
  create(draft: SourceLinkDraft): Promise<SourceLink>;
  relink(id: string, relink: SourceRelink): Promise<SourceLink>;
  recordCheck(id: string, check: SourceCheck): Promise<SourceLink>;
  recordError(id: string, error: SourceError): Promise<SourceLink>;
  findByChannel(channelId: string): Promise<SourceLink | null>;
  saveChannel(id: string, channel: PushChannel | null): Promise<SourceLink>;
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
  readonly by: Editor | null;
}

export interface ChangeListener {
  changed(change: SheetChange): Promise<void>;
}

export interface WatchRequest {
  readonly address: string;
  readonly ttlMs: number;
}

export interface FileWatcher {
  watch(
    accessToken: string,
    fileId: string,
    request: WatchRequest,
  ): Promise<PushChannel>;
  stop(accessToken: string, channel: PushChannel): Promise<void>;
}

export interface EditorLookup {
  lastEditor(accessToken: string, fileId: string): Promise<Editor | null>;
}

export interface AutodeskEventRepository {
  recordIfNew(change: AutodeskChange, receivedAt: Date): Promise<boolean>;
}

export interface AutodeskChangeListener {
  changed(change: AutodeskChange): Promise<void>;
}
