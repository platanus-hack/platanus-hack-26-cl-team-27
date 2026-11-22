import type { CargaOptions } from './options.ts';
import type { ActionStats, EndpointStats } from './stats.ts';

export interface Report {
  readonly escenario: string;
  readonly clientes: number;
  readonly minutos: number;
  readonly ciclos: number;
  readonly base: string;
  readonly espera: number;
  readonly segundos: number;
  readonly eventosPorSegundo: number;
  readonly endpoints: readonly EndpointStats[];
  readonly acciones: readonly ActionStats[];
  readonly cumple: boolean;
}

export const meetsCriterion = (actions: readonly ActionStats[]): boolean =>
  actions.length > 0 &&
  actions.every((action) => action.underLimit === action.expected);

const ms = (value: number): string => `${Math.round(value)} ms`;

const percent = (action: ActionStats): string =>
  action.expected === 0
    ? '-'
    : `${((action.underLimit / action.expected) * 100).toFixed(1)} %`;

const errorsOf = (errors: Readonly<Record<string, number>>): string => {
  const entries = Object.entries(errors);
  return entries.length === 0
    ? '-'
    : entries.map(([code, count]) => `${code}×${count}`).join(' ');
};

const table = (
  head: readonly string[],
  rows: readonly (readonly string[])[],
): string[] => {
  const widths = head.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const line = (cells: readonly string[]): string =>
    cells
      .map((cell, column) =>
        column === 0
          ? cell.padEnd(widths[column] ?? 0)
          : cell.padStart(widths[column] ?? 0),
      )
      .join('  ');
  return [line(head), ...rows.map(line)];
};

export const requestsPerSecond = (
  endpoints: readonly EndpointStats[],
  endpoint: string,
  seconds: number,
): number => {
  const count = endpoints.find((entry) => entry.endpoint === endpoint)?.count;
  return seconds > 0 && count !== undefined
    ? Math.round((count / seconds) * 100) / 100
    : 0;
};

export const buildReport = (
  options: CargaOptions,
  cycles: number,
  endpoints: readonly EndpointStats[],
  actions: readonly ActionStats[],
  seconds = 0,
): Report => ({
  escenario: options.escenario,
  clientes: options.clientes,
  minutos: options.minutos,
  ciclos: cycles,
  base: options.base,
  espera: options.espera,
  segundos: Math.round(seconds * 10) / 10,
  eventosPorSegundo: requestsPerSecond(endpoints, 'GET /events', seconds),
  endpoints,
  acciones: actions,
  cumple: meetsCriterion(actions),
});

export const formatReport = (report: Report): string[] => {
  const lines: string[] = [
    '',
    `Informe · escenario ${report.escenario} · ${report.ciclos} ciclos · ${report.base}`,
    '',
    'Por endpoint',
    ...table(
      ['endpoint', 'cantidad', 'errores', 'p50', 'p95', 'p99', 'máximo'],
      report.endpoints.map((entry) => [
        entry.endpoint,
        String(entry.count),
        errorsOf(entry.errors),
        ms(entry.p50),
        ms(entry.p95),
        ms(entry.p99),
        ms(entry.max),
      ]),
    ),
    '',
    `GET /events: ${report.eventosPorSegundo} peticiones por segundo en ${report.segundos} s · espera ${report.espera} s`,
    '',
    'Por acción: cuánto tarda en verse, sobre todos los espectadores y ciclos',
    ...table(
      ['acción', 'vistas', 'p50', 'p95', 'máximo', 'bajo 2 s'],
      report.acciones.map((action) => [
        action.action,
        `${action.seen}/${action.expected}`,
        ms(action.p50),
        ms(action.p95),
        ms(action.max),
        percent(action),
      ]),
    ),
    '',
    `${report.clientes} clientes · ${report.minutos} min · todo se ve en < 2 s: ${report.cumple ? '✓' : '✗'}`,
  ];
  return lines;
};
