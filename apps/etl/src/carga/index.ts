import { writeFileSync } from 'node:fs';

import { Http } from './http.ts';
import {
  type CargaOptions,
  isLocalBase,
  LOCAL_PRESENTER_KEY,
  CargaUsageError,
} from './options.ts';
import { buildReport, formatReport, type Report } from './report.ts';
import { CargaAbort, type Context, runCaso, runSala } from './scenarios.ts';
import { Metrics, Tracker } from './stats.ts';

export const resolvePresenterKey = (
  options: CargaOptions,
  env: NodeJS.ProcessEnv,
): string => {
  const key = env['PRESENTER_KEY'];
  if (key) return key;
  if (isLocalBase(options.base)) return LOCAL_PRESENTER_KEY;
  throw new CargaUsageError(
    'Para correr contra otra API define PRESENTER_KEY en el entorno.',
  );
};

export const runCarga = async (
  options: CargaOptions,
  out: (line: string) => void,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Report> => {
  const presenterKey = resolvePresenterKey(options, env);
  const metrics = new Metrics();
  const tracker = new Tracker();
  const interrupt = new AbortController();
  const onSignal = (): void => {
    out('Interrumpido: reinicio el caso y suelto los asientos.');
    interrupt.abort();
  };
  process.once('SIGINT', onSignal);
  const ctx: Context = {
    http: new Http(options.base, metrics),
    options,
    presenterKey,
    tracker,
    signal: interrupt.signal,
    out,
  };
  out(
    `Carga · escenario ${options.escenario} · ${options.clientes} clientes · ${options.minutos} min · ciclo de ${options.ciclo} s · espera ${options.espera} s · ${options.base}`,
  );
  let cycles = 0;
  const started = performance.now();
  try {
    cycles =
      options.escenario === 'caso' ? await runCaso(ctx) : await runSala(ctx);
  } finally {
    process.off('SIGINT', onSignal);
  }
  const report = buildReport(
    options,
    cycles,
    metrics.endpoints(),
    tracker.actions(),
    (performance.now() - started) / 1000,
  );
  for (const line of formatReport(report)) out(line);
  if (options.json !== null) {
    writeFileSync(options.json, `${JSON.stringify(report, null, 2)}\n`);
    out(`Informe escrito en ${options.json}`);
  }
  return report;
};

export { CargaAbort, CargaUsageError };
