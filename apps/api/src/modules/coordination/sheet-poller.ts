import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';

import { ProjectCatalogs } from '../project/project.module.ts';
import { CoordinationService } from './coordination.service.ts';

export const SHEET_ID = '1plICs-go_g91zGKQ6p35r67ztd2zfCbBLrJvSucVRYo';
export const SHEET_TAB = 'Partidas';
export const SHEET_PROJECT = 'los-aromos';
export const SHEET_DOCUMENT = 'presupuesto';
export const SHEET_POLL_MS = 10_000;

export interface SheetCell {
  readonly code: string;
  readonly subject: string;
  readonly attribute: string;
  readonly unit: string;
}

export const SHEET_CELLS: readonly SheetCell[] = [
  { code: '03.02', subject: 'partida-03.02', attribute: 'precio_unitario', unit: '$/m³' },
  { code: '03.03', subject: 'partida-03.03', attribute: 'precio_unitario', unit: '$/kg' },
  { code: '06.01', subject: 'partida-07.01', attribute: 'precio_unitario', unit: '$/m²' },
];

export const sheetUrl = (id = SHEET_ID): string =>
  `https://docs.google.com/spreadsheets/d/${id}/edit`;

const csvUrl = (id: string, tab: string): string =>
  `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&t=${Date.now()}`;

export const parseCsv = (text: string): string[][] =>
  text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const cells: string[] = [];
      let current = '';
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i]!;
        if (char === '"') {
          if (quoted && line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            quoted = !quoted;
          }
        } else if (char === ',' && !quoted) {
          cells.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current);
      return cells;
    });

export const parseMoney = (text: string): number | null => {
  const digits = text.replace(/[^0-9]/g, '');
  return digits === '' ? null : Number(digits);
};

export const readPrices = (
  rows: readonly string[][],
  cells: readonly SheetCell[] = SHEET_CELLS,
): Map<string, number> => {
  const prices = new Map<string, number>();
  for (const row of rows) {
    const cell = cells.find((item) => item.code === row[0]?.trim());
    const value = cell ? parseMoney(row[2] ?? '') : null;
    if (cell && value !== null) prices.set(cell.code, value);
  }
  return prices;
};

export const changedPrices = (
  now: ReadonlyMap<string, number>,
  before: ReadonlyMap<string, number>,
): string[] =>
  [...now.entries()]
    .filter(([code, value]) => before.has(code) && before.get(code) !== value)
    .map(([code]) => code);

const clock = (date: Date): string =>
  date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Santiago',
  });

@Injectable()
export class SheetPoller implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Google Sheets');
  private readonly coordination: CoordinationService;
  private readonly catalogs: ProjectCatalogs;
  private timer: ReturnType<typeof setInterval> | null = null;
  private last: Map<string, number> | null = null;
  private running = false;

  constructor(
    @Inject(CoordinationService) coordination: CoordinationService,
    @Inject(ProjectCatalogs) catalogs: ProjectCatalogs,
  ) {
    this.coordination = coordination;
    this.catalogs = catalogs;
  }

  onApplicationBootstrap(): void {
    if (process.env['NODE_ENV'] === 'test' || process.env['SHEET_POLL'] === 'off') {
      return;
    }
    this.timer = setInterval(() => void this.tick(), SHEET_POLL_MS);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const response = await fetch(csvUrl(SHEET_ID, SHEET_TAB), {
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return;
      const prices = readPrices(parseCsv(await response.text()));
      if (prices.size === 0) return;
      if (this.last === null) {
        this.last = prices;
        this.logger.log(`Escucho la planilla ${sheetUrl()} (${prices.size} precios)`);
        return;
      }
      const changed = changedPrices(prices, this.last);
      this.last = prices;
      if (changed.length > 0) await this.ingest(changed, prices);
    } catch (error) {
      this.logger.warn(
        `No pude leer la planilla: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async ingest(
    codes: readonly string[],
    prices: ReadonlyMap<string, number>,
  ): Promise<void> {
    const project = await this.catalogs.load(SHEET_PROJECT).catch(() => null);
    const document = project?.documentDef(SHEET_DOCUMENT);
    if (!project || !document) return;
    const now = new Date();
    await this.coordination.ingest({
      project,
      actor: document.ownerId,
      revision: {
        documentId: document.id,
        label: `Google Sheets ${clock(now)}`,
        spaceId: document.spaceId,
        pointer: sheetUrl(),
        claims: codes.map((code) => {
          const cell = SHEET_CELLS.find((item) => item.code === code)!;
          return {
            subject: cell.subject,
            attribute: cell.attribute,
            value: prices.get(code)!,
            unit: cell.unit,
            role: 'afirma' as const,
            locator: `${SHEET_TAB}!C · ${code}`,
          };
        }),
      },
      actionId: `sheet-${now.getTime()}`,
    });
    this.logger.log(`Cambió la planilla (${codes.join(', ')}): entró como revisión del presupuesto`);
  }
}
