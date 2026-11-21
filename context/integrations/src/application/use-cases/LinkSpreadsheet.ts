import type { SourceLink } from '../../domain/Connection.ts';
import { spreadsheetIdOf } from '../../domain/Spreadsheet.ts';
import { IntegrationError } from '../errors.ts';
import type {
  AccountAuthorizer,
  ConnectionRepository,
  SourceLinkRepository,
  SpreadsheetReader,
} from '../ports/index.ts';
import { requireGoogle } from './requireGoogle.ts';

export interface LinkInput {
  readonly url: string;
  readonly documentId: string;
}

export class LinkSpreadsheet {
  private readonly connections: ConnectionRepository;
  private readonly authorizer: AccountAuthorizer;
  private readonly reader: SpreadsheetReader;
  private readonly sources: SourceLinkRepository;

  constructor(
    connections: ConnectionRepository,
    authorizer: AccountAuthorizer,
    reader: SpreadsheetReader,
    sources: SourceLinkRepository,
  ) {
    this.connections = connections;
    this.authorizer = authorizer;
    this.reader = reader;
    this.sources = sources;
  }

  async execute(input: LinkInput): Promise<SourceLink> {
    const spreadsheetId = spreadsheetIdOf(input.url);
    if (spreadsheetId === null) {
      throw new IntegrationError(
        'invalid_sheet_url',
        'Ese link no es de una planilla de Google Sheets',
      );
    }
    const connection = await requireGoogle(this.connections);
    if ((await this.sources.findByDocument(input.documentId)) !== null) {
      throw new IntegrationError(
        'already_linked',
        'Ese documento ya tiene una planilla vinculada: desvincúlala antes',
      );
    }
    const token = await this.authorizer.accessToken(connection.refreshToken);
    const snapshot = await this.reader.read(token, spreadsheetId);
    return this.sources.create({
      connectionId: connection.id,
      provider: 'google',
      externalId: spreadsheetId,
      documentId: input.documentId,
      title: snapshot.title,
      pointer: snapshot.pointer,
    });
  }
}
