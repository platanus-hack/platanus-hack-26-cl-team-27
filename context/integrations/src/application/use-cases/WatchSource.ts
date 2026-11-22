import type { SourceLink } from '../../domain/Connection.ts';
import { canWatch, type Editor } from '../../domain/Push.ts';
import { diffSnapshots } from '../../domain/Sheet.ts';
import { IntegrationError, ProviderError } from '../errors.ts';
import type {
  AccountAuthorizer,
  ChangeListener,
  ConnectionRepository,
  EditorLookup,
  SnapshotCache,
  SourceLinkRepository,
  SpreadsheetReader,
} from '../ports/index.ts';
import { connectionOf, sourceNotFound } from './requireGoogle.ts';

export type WatchStatus = 'changed' | 'unchanged' | 'failed';

export interface WatchResult {
  readonly status: WatchStatus;
  readonly source: SourceLink;
  readonly message: string;
  readonly cells: number | null;
  readonly failure?: unknown;
}

export const UNCHANGED_MESSAGE =
  'La planilla no cambió desde la última revisión';

const UNKNOWN_FAILURE = 'Algo falló al revisar la planilla';

const changedMessage = (cells: number | null): string => {
  if (cells === null) return 'La planilla cambió';
  return cells === 1
    ? 'La planilla cambió: 1 celda'
    : `La planilla cambió: ${cells} celdas`;
};

const isKnown = (error: unknown): error is Error =>
  error instanceof IntegrationError || error instanceof ProviderError;

export class WatchSource {
  private readonly connections: ConnectionRepository;
  private readonly authorizer: AccountAuthorizer;
  private readonly reader: SpreadsheetReader;
  private readonly sources: SourceLinkRepository;
  private readonly snapshots: SnapshotCache;
  private readonly listener: ChangeListener;
  private readonly now: () => Date;
  private readonly editors: EditorLookup | null;

  constructor(
    connections: ConnectionRepository,
    authorizer: AccountAuthorizer,
    reader: SpreadsheetReader,
    sources: SourceLinkRepository,
    snapshots: SnapshotCache,
    listener: ChangeListener,
    now: () => Date = () => new Date(),
    editors: EditorLookup | null = null,
  ) {
    this.connections = connections;
    this.authorizer = authorizer;
    this.reader = reader;
    this.sources = sources;
    this.snapshots = snapshots;
    this.listener = listener;
    this.now = now;
    this.editors = editors;
  }

  async execute(id: string, projectId?: string): Promise<WatchResult> {
    const source = await this.sources.find(id);
    if (
      source === null ||
      (projectId !== undefined && source.projectId !== projectId)
    ) {
      throw sourceNotFound();
    }
    try {
      return await this.check(source);
    } catch (error) {
      const message = isKnown(error) ? error.message : UNKNOWN_FAILURE;
      const updated = await this.sources.recordError(source.id, {
        at: this.now(),
        message,
      });
      return {
        status: 'failed',
        source: updated,
        message,
        cells: null,
        failure: isKnown(error) ? undefined : error,
      };
    }
  }

  private async check(source: SourceLink): Promise<WatchResult> {
    const connection = await connectionOf(this.connections, source);
    const token = await this.authorizer.accessToken(connection.refreshToken);
    const content = await this.reader.read(token, source.externalId);
    const at = this.now();
    const previous = this.snapshots.get(source.id);
    this.snapshots.set(source.id, { tabs: content.tabs });
    const cells =
      content.contentHash === source.contentHash
        ? []
        : previous
          ? diffSnapshots(previous, content)
          : null;
    const changed = cells === null || cells.length > 0;
    const by = changed
      ? await this.editorOf(connection.scopes, token, source.externalId)
      : null;
    const updated = await this.sources.recordCheck(source.id, {
      at,
      title: content.title,
      contentHash: content.contentHash,
      changed,
      by,
    });
    if (!changed) {
      return {
        status: 'unchanged',
        source: updated,
        message: UNCHANGED_MESSAGE,
        cells: 0,
      };
    }
    await this.listener.changed({ source: updated, at, cells, by });
    return {
      status: 'changed',
      source: updated,
      message: changedMessage(cells?.length ?? null),
      cells: cells?.length ?? null,
    };
  }

  private async editorOf(
    scopes: readonly string[],
    token: string,
    fileId: string,
  ): Promise<Editor | null> {
    if (this.editors === null || !canWatch(scopes)) return null;
    try {
      return await this.editors.lastEditor(token, fileId);
    } catch {
      return null;
    }
  }
}
