import type { SourceLink } from '../../domain/Connection.ts';
import {
  readBudgetSheet,
  SheetFormatError,
} from '../../domain/readBudgetSheet.ts';
import { sheetsRevisionLabel } from '../../domain/Spreadsheet.ts';
import type { SourceVocabulary } from '../../domain/Vocabulary.ts';
import { DeliveryError, IntegrationError, ProviderError } from '../errors.ts';
import type {
  AccountAuthorizer,
  ConnectionRepository,
  DeliveryReceipt,
  RevisionSink,
  SourceLinkRepository,
  SpreadsheetReader,
} from '../ports/index.ts';
import { requireGoogle } from './requireGoogle.ts';

export type SyncStatus = 'ingested' | 'unchanged' | 'waiting' | 'failed';

export interface SyncResult {
  readonly status: SyncStatus;
  readonly source: SourceLink;
  readonly message: string;
  readonly receipt: DeliveryReceipt | null;
  readonly failure?: unknown;
}

export const WAITING_MESSAGE =
  'La obra todavía no tiene la carga inicial: leemos la planilla cuando llegue';

export const UNCHANGED_MESSAGE =
  'La planilla no cambió desde la última lectura';

const UNKNOWN_FAILURE = 'Algo falló al leer la planilla';

const isKnown = (error: unknown): error is Error =>
  error instanceof IntegrationError ||
  error instanceof ProviderError ||
  error instanceof DeliveryError ||
  error instanceof SheetFormatError;

export class SyncSource {
  private readonly connections: ConnectionRepository;
  private readonly authorizer: AccountAuthorizer;
  private readonly reader: SpreadsheetReader;
  private readonly sources: SourceLinkRepository;
  private readonly sink: RevisionSink;
  private readonly vocabulary: SourceVocabulary;
  private readonly now: () => Date;

  constructor(
    connections: ConnectionRepository,
    authorizer: AccountAuthorizer,
    reader: SpreadsheetReader,
    sources: SourceLinkRepository,
    sink: RevisionSink,
    vocabulary: SourceVocabulary,
    now: () => Date = () => new Date(),
  ) {
    this.connections = connections;
    this.authorizer = authorizer;
    this.reader = reader;
    this.sources = sources;
    this.sink = sink;
    this.vocabulary = vocabulary;
    this.now = now;
  }

  async execute(id: string): Promise<SyncResult> {
    const source = await this.sources.find(id);
    if (source === null) {
      throw new IntegrationError(
        'source_not_found',
        'Esa planilla ya no está vinculada',
      );
    }
    const epoch = await this.sink.epoch();
    if (epoch === null) {
      return {
        status: 'waiting',
        source,
        message: WAITING_MESSAGE,
        receipt: null,
      };
    }
    try {
      return await this.read(source, epoch);
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
        receipt: null,
        failure: isKnown(error) ? undefined : error,
      };
    }
  }

  private async read(source: SourceLink, epoch: number): Promise<SyncResult> {
    const connection = await requireGoogle(this.connections);
    const token = await this.authorizer.accessToken(connection.refreshToken);
    const snapshot = await this.reader.read(token, source.externalId);
    const at = this.now();
    if (
      source.lastRead?.hash === snapshot.contentHash &&
      source.lastRead.epoch === epoch
    ) {
      return {
        status: 'unchanged',
        source: await this.sources.recordCheck(source.id, at, snapshot.title),
        message: UNCHANGED_MESSAGE,
        receipt: null,
      };
    }
    const reading = readBudgetSheet(snapshot.tab, this.vocabulary);
    const asserts = reading.chunks.some((chunk) =>
      chunk.claims.some((claim) => claim.role === 'afirma'),
    );
    if (!asserts) {
      throw new IntegrationError(
        'sheet_empty',
        'La planilla no trae precios de las partidas que sigue la obra',
      );
    }
    const label = sheetsRevisionLabel(at);
    const receipt = await this.sink.deliver({
      documentId: source.documentId,
      label,
      pointer: snapshot.pointer,
      contentHash: snapshot.contentHash,
      chunks: reading.chunks,
    });
    const updated = await this.sources.recordRead(
      source.id,
      {
        at,
        hash: snapshot.contentHash,
        epoch,
        label,
        ignored: reading.ignored,
      },
      snapshot.title,
    );
    return {
      status: 'ingested',
      source: updated,
      message: receipt.summary,
      receipt,
    };
  }
}
