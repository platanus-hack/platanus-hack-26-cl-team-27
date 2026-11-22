import type { SourceLink } from '../../domain/Connection.ts';
import { spreadsheetIdOf } from '../../domain/Spreadsheet.ts';
import { IntegrationError } from '../errors.ts';
import type {
  AccountAuthorizer,
  ConnectionRepository,
  SnapshotCache,
  SourceLinkRepository,
  SpreadsheetReader,
} from '../ports/index.ts';
import { requireGoogle } from './requireGoogle.ts';

export interface LinkRequest {
  readonly userId: string;
  readonly projectId: string;
  readonly url: string;
}

export class LinkSpreadsheet {
  private readonly connections: ConnectionRepository;
  private readonly authorizer: AccountAuthorizer;
  private readonly reader: SpreadsheetReader;
  private readonly sources: SourceLinkRepository;
  private readonly snapshots: SnapshotCache;
  private readonly now: () => Date;

  constructor(
    connections: ConnectionRepository,
    authorizer: AccountAuthorizer,
    reader: SpreadsheetReader,
    sources: SourceLinkRepository,
    snapshots: SnapshotCache,
    now: () => Date = () => new Date(),
  ) {
    this.connections = connections;
    this.authorizer = authorizer;
    this.reader = reader;
    this.sources = sources;
    this.snapshots = snapshots;
    this.now = now;
  }

  async execute({ userId, projectId, url }: LinkRequest): Promise<SourceLink> {
    const spreadsheetId = spreadsheetIdOf(url);
    if (spreadsheetId === null) {
      throw new IntegrationError(
        'invalid_sheet_url',
        'Ese link no es de una planilla de Google Sheets',
      );
    }
    const connection = await requireGoogle(this.connections, userId);
    const existing = await this.sources.findInProject(projectId, spreadsheetId);
    if (existing !== null && existing.connectionId !== null) {
      throw new IntegrationError(
        'already_linked',
        'Esa planilla ya está vinculada a este proyecto',
      );
    }
    const token = await this.authorizer.accessToken(connection.refreshToken);
    const content = await this.reader.read(token, spreadsheetId);
    const at = this.now();
    const source =
      existing === null
        ? await this.sources.create({
            projectId,
            connectionId: connection.id,
            provider: 'google',
            externalId: spreadsheetId,
            title: content.title,
            pointer: content.pointer,
            contentHash: content.contentHash,
            checkedAt: at,
          })
        : await this.sources.relink(existing.id, {
            connectionId: connection.id,
            at,
            title: content.title,
            contentHash: content.contentHash,
          });
    this.snapshots.set(source.id, { tabs: content.tabs });
    return source;
  }
}
