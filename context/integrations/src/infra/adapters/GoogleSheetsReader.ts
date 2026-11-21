import { createHash } from 'node:crypto';

import { ProviderError } from '../../application/errors.ts';
import type {
  SpreadsheetReader,
  SpreadsheetSnapshot,
} from '../../application/ports/index.ts';
import type { CellValue } from '../../domain/Sheet.ts';
import { spreadsheetUrl } from '../../domain/Spreadsheet.ts';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

interface SheetProperties {
  readonly sheetId?: number;
  readonly title?: string;
  readonly index?: number;
}

interface SpreadsheetMeta {
  readonly properties?: { readonly title?: string };
  readonly sheets?: readonly { readonly properties?: SheetProperties }[];
}

interface ValueRange {
  readonly values?: readonly (readonly unknown[])[];
}

interface GoogleErrorBody {
  readonly error?: {
    readonly message?: string;
    readonly details?: readonly { readonly reason?: string }[];
  };
}

const toCell = (value: unknown): CellValue =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean'
    ? value
    : null;

const quoteSheet = (title: string): string => `'${title.replace(/'/g, "''")}'`;

const errorFor = (status: number, body: GoogleErrorBody): ProviderError => {
  const disabled = body.error?.details?.some(
    (detail) => detail.reason === 'SERVICE_DISABLED',
  );
  if (disabled) {
    return new ProviderError(
      'La API de Google Sheets no está activada en el proyecto de Google Cloud',
      status,
    );
  }
  switch (status) {
    case 401:
      return new ProviderError(
        'Google no aceptó el permiso: vuelve a conectar la cuenta',
        status,
      );
    case 403:
      return new ProviderError(
        'Tu cuenta de Google no tiene acceso a esa planilla',
        status,
      );
    case 404:
      return new ProviderError(
        'No encontramos esa planilla: revisa el link',
        status,
      );
    default:
      return new ProviderError(`Google Sheets respondió ${status}`, status);
  }
};

export class GoogleSheetsReader implements SpreadsheetReader {
  private readonly fetch: typeof fetch;

  constructor(options: { readonly fetch?: typeof fetch } = {}) {
    this.fetch = options.fetch ?? fetch;
  }

  async read(
    accessToken: string,
    spreadsheetId: string,
  ): Promise<SpreadsheetSnapshot> {
    const id = encodeURIComponent(spreadsheetId);
    const meta = await this.get<SpreadsheetMeta>(
      `${SHEETS_API}/${id}?fields=properties.title,sheets.properties(sheetId,title,index)`,
      accessToken,
    );
    const first = [...(meta.sheets ?? [])]
      .map((sheet) => sheet.properties ?? {})
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
    if (!first?.title) {
      throw new ProviderError('La planilla no tiene hojas');
    }
    const range = await this.get<ValueRange>(
      `${SHEETS_API}/${id}/values/${encodeURIComponent(quoteSheet(first.title))}?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`,
      accessToken,
    );
    const tab = {
      title: first.title,
      rows: (range.values ?? []).map((row) => row.map(toCell)),
    };
    const title = meta.properties?.title ?? first.title;
    return {
      title,
      tab,
      pointer: spreadsheetUrl(spreadsheetId, first.sheetId),
      contentHash: createHash('sha256')
        .update(JSON.stringify({ title, tab }))
        .digest('hex'),
    };
  }

  private async get<T>(url: string, accessToken: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetch(url, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
      });
    } catch {
      throw new ProviderError('No pudimos hablar con Google Sheets');
    }
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw errorFor(response.status, body as GoogleErrorBody);
    return body as T;
  }
}
