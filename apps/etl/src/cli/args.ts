import { type CargaOptions, parseCargaArgs } from '../carga/options.ts';
import { SPEEDS, type Speed } from '../players/plan.ts';

export type Command =
  | { readonly name: 'interactivo'; readonly speed: Speed }
  | { readonly name: 'auto'; readonly speed: Speed }
  | { readonly name: 'reiniciar' }
  | { readonly name: 'paso'; readonly id: string; readonly speed: Speed }
  | { readonly name: 'estado' }
  | { readonly name: 'carga'; readonly options: CargaOptions }
  | { readonly name: 'ayuda' };

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export const USAGE = `Uso: pnpm etl [comando]

  (sin comando)              modo interactivo: Enter carga el paso siguiente
  auto [--velocidad 1|2|4]   corre todo el guion sin pausas
  reiniciar                  reinicia la sala y hace la carga inicial
  paso <id>                  carga un paso del guion (s1 s2 s3 s4 x1 x2 s5 s6)
  estado                     muestra cómo va la sala
  carga [opciones]           simula celulares sondeando la sala y mide cuánto tarda en verse cada cambio
                             --clientes 30 --minutos 5 --escenario caso|sala --pulsos 1|2 --historial
                             --ciclo 60 --base <url> --produccion --forzar --json <ruta>

En el modo interactivo: Enter = paso siguiente, a = automático desde aquí,
r = reiniciar, o = reabrir una disputa, q = salir.

Variables: API_URL (por defecto http://localhost:3001) y PRESENTER_KEY.`;

const speedOf = (raw: string | undefined): Speed => {
  const value = Number(raw);
  const found = SPEEDS.find((speed) => speed === value);
  if (found === undefined) {
    throw new UsageError('La velocidad debe ser 1, 2 o 4.');
  }
  return found;
};

export const parseArgs = (argv: readonly string[]): Command => {
  if (argv[0] === 'carga') {
    if (argv.slice(1).some((arg) => arg === '--help' || arg === '-h'))
      return { name: 'ayuda' };
    return { name: 'carga', options: parseCargaArgs(argv.slice(1)) };
  }
  const positional: string[] = [];
  let speed: Speed = 1;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';
    if (arg === '--help' || arg === '-h') return { name: 'ayuda' };
    if (arg === '--velocidad') {
      speed = speedOf(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--velocidad=')) {
      speed = speedOf(arg.slice('--velocidad='.length));
    } else if (arg.startsWith('-')) {
      throw new UsageError(`No conozco la opción ${arg}.`);
    } else {
      positional.push(arg);
    }
  }
  const [name, id, ...rest] = positional;
  if (rest.length > 0) throw new UsageError('Sobran argumentos.');
  switch (name) {
    case undefined:
      return { name: 'interactivo', speed };
    case 'auto':
      return { name: 'auto', speed };
    case 'reiniciar':
      return { name: 'reiniciar' };
    case 'estado':
      return { name: 'estado' };
    case 'ayuda':
      return { name: 'ayuda' };
    case 'paso':
      if (id === undefined)
        throw new UsageError('Falta el id del paso: pnpm etl paso <id>.');
      return { name: 'paso', id, speed };
    default:
      throw new UsageError(`No conozco el comando «${name}».`);
  }
};
