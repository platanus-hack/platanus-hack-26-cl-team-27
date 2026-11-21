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

  async execute(url: string): Promise<SourceLink> {
    const spreadsheetId = spreadsheetIdOf(url);
    if (spreadsheetId === null) {
      throw new IntegrationError(
        'invalid_sheet_url',
        'Ese link no es de una planilla de Google Sheets',
      );
    }
    const connection = await requireGoogle(this.connections);
    if ((await this.sources.findByExternalId(spreadsheetId)) !== null) {
      throw new IntegrationError(
        'already_linked',
        'Esa planilla ya está vinculada',
      );
    }
    const token = await this.authorizer.accessToken(connection.refreshToken);
    const content = await this.reader.read(token, spreadsheetId);
    const source = await this.sources.create({
      connectionId: connection.id,
      provider: 'google',
      externalId: spreadsheetId,
      title: content.title,
      pointer: content.pointer,
      contentHash: content.contentHash,
      checkedAt: this.now(),
    });
    this.snapshots.set(source.id, { tabs: content.tabs });
    return source;
  }
}
