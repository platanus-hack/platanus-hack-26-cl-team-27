import { parseArgs, USAGE, UsageError, type Command } from './cli/args.ts';
import { Prompt } from './cli/prompt.ts';
import { Session, type Interrupt } from './cli/session.ts';
import { CargaAbort, CargaUsageError, runCarga } from './carga/index.ts';
import { readConfig } from './config.ts';
import { findPaso, PASOS } from './guion.ts';
import { Api, ApiError, ApiUnreachable, isBadKey } from './load/api.ts';
import { indexByPath, readLake } from './pipeline.ts';
import { Players } from './players/players.ts';
import { ParseError } from './types.ts';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const MENU =
  '[Enter] cargar el paso · [a] automático desde aquí · [r] reiniciar · [o] reabrir · [q] salir > ';

const interactive = async (session: Session, prompt: Prompt): Promise<void> => {
  await session.ensureSeeded();
  for (;;) {
    out('');
    const paso = await session.nextPaso();
    if (paso === null) {
      await session.cierre();
      out('El guion terminó. [r] reiniciar · [q] salir');
    } else {
      out(`Siguiente: ${paso.id} · ${paso.title}`);
      out(`  ${paso.hint}`);
    }
    const answer = await prompt.ask(MENU);
    if (answer === null || answer === 'q') return;
    if (answer === 'r') {
      await session.reiniciar();
    } else if (answer === 'o') {
      await session.reabrir();
    } else if (answer === 'a') {
      const outcome = await session.runAuto(1);
      if (outcome === 'salir') return;
    } else if (answer === '' && paso !== null) {
      const outcome = await session.runPaso(paso);
      if (outcome === 'salir') return;
    }
  }
};

const run = async (command: Command): Promise<void> => {
  if (command.name === 'ayuda') {
    out(USAGE);
    return;
  }
  if (command.name === 'carga') {
    const report = await runCarga(command.options, out);
    if (!report.cumple) process.exitCode = 1;
    return;
  }
  const config = readConfig();
  const api = new Api(config);
  const items = indexByPath(readLake());
  const speed = 'speed' in command ? command.speed : 1;
  const players = new Players(api, {
    speed,
    auto: command.name !== 'interactivo',
  });
  const prompt =
    command.name === 'interactivo'
      ? new Prompt(process.stdin, process.stdout)
      : null;
  const interrupt = (): Interrupt | null => {
    if (prompt === null) return null;
    if (prompt.isClosed()) return 'salir';
    const line = prompt.take();
    if (line === null) return null;
    if (line === 'q') return 'salir';
    if (line === 'o') return 'reabrir';
    return 'saltar';
  };
  const session = new Session({
    api,
    items,
    players,
    out,
    sleep,
    ...(prompt === null ? {} : { interrupt }),
  });
  try {
    switch (command.name) {
      case 'interactivo':
        out('ETL de la sala de la obra · conectores y jugadores simulados');
        if (prompt) await interactive(session, prompt);
        break;
      case 'auto':
        await session.ensureSeeded();
        await session.runAuto(command.speed);
        break;
      case 'reiniciar':
        await session.reiniciar();
        break;
      case 'estado':
        await session.estado();
        break;
      case 'paso': {
        const paso = findPaso(command.id);
        if (paso === undefined) {
          throw new Error(
            `No existe el paso «${command.id}». Los pasos son: ${PASOS.map((p) => p.id).join(', ')}.`,
          );
        }
        await session.ensureSeeded();
        const outcome = await session.runPaso(paso);
        if (outcome === 'fallido' || outcome === 'bloqueado')
          process.exitCode = 1;
        break;
      }
    }
  } finally {
    players.stop();
    prompt?.close();
  }
};

const explain = (error: unknown): string => {
  if (error instanceof CargaUsageError || error instanceof CargaAbort)
    return error.message;
  if (error instanceof UsageError) return `${error.message}\n\n${USAGE}`;
  if (error instanceof ApiUnreachable) return error.message;
  if (isBadKey(error)) {
    return 'La API rechazó la clave de presentador (401). Revisa PRESENTER_KEY en tu .env.';
  }
  if (error instanceof ApiError)
    return `La API respondió ${error.status}: ${error.message}`;
  if (error instanceof ParseError)
    return `No pude leer el lago: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
};

try {
  await run(parseArgs(process.argv.slice(2)));
} catch (error) {
  process.stderr.write(`${explain(error)}\n`);
  process.exitCode = 1;
}
