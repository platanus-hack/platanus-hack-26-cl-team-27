export type Escenario = 'caso' | 'sala';

export interface CargaOptions {
  readonly clientes: number;
  readonly minutos: number;
  readonly escenario: Escenario;
  readonly pulsos: 1 | 2;
  readonly historial: boolean;
  readonly ciclo: number;
  readonly espera: number;
  readonly base: string;
  readonly produccion: boolean;
  readonly forzar: boolean;
  readonly json: string | null;
}

export const DEFAULT_BASE = 'http://localhost:3001/api';
export const LOCAL_PRESENTER_KEY = 'sala-los-aromos';

export class CargaUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CargaUsageError';
  }
}

export const isLocalBase = (base: string): boolean => {
  try {
    const { hostname } = new URL(base);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

const positive = (name: string, raw: string | undefined): number => {
  const value = Number(raw);
  if (
    raw === undefined ||
    raw === '' ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new CargaUsageError(`${name} debe ser un número mayor que cero.`);
  }
  return value;
};

const VALUE_FLAGS = new Set([
  '--clientes',
  '--minutos',
  '--escenario',
  '--pulsos',
  '--ciclo',
  '--espera',
  '--base',
  '--json',
]);

const BOOLEAN_FLAGS = new Set(['--historial', '--produccion', '--forzar']);

export const parseCargaArgs = (argv: readonly string[]): CargaOptions => {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';
    const equals = arg.indexOf('=');
    const name = equals === -1 ? arg : arg.slice(0, equals);
    const inline = equals === -1 ? undefined : arg.slice(equals + 1);
    if (BOOLEAN_FLAGS.has(name) && inline === undefined) {
      flags.add(name);
    } else if (VALUE_FLAGS.has(name)) {
      const value = inline ?? argv[index + 1];
      if (
        value === undefined ||
        (inline === undefined && value.startsWith('--'))
      ) {
        throw new CargaUsageError(`Falta el valor de ${name}.`);
      }
      values.set(name, value);
      if (inline === undefined) index += 1;
    } else {
      throw new CargaUsageError(
        arg.startsWith('-')
          ? `No conozco la opción ${arg} de carga.`
          : 'Sobran argumentos.',
      );
    }
  }
  const clientes = positive('--clientes', values.get('--clientes') ?? '30');
  if (!Number.isInteger(clientes)) {
    throw new CargaUsageError('--clientes debe ser un entero.');
  }
  const escenario = values.get('--escenario') ?? 'caso';
  if (escenario !== 'caso' && escenario !== 'sala') {
    throw new CargaUsageError('El escenario debe ser caso o sala.');
  }
  const pulsos = Number(values.get('--pulsos') ?? '1');
  if (pulsos !== 1 && pulsos !== 2) {
    throw new CargaUsageError('--pulsos debe ser 1 o 2.');
  }
  const espera = Number(values.get('--espera') ?? '10');
  if (!Number.isInteger(espera) || espera < 0 || espera > 10) {
    throw new CargaUsageError('--espera debe ser un entero de 0 a 10.');
  }
  const base = (values.get('--base') ?? DEFAULT_BASE).replace(/\/+$/, '');
  try {
    new URL(base);
  } catch {
    throw new CargaUsageError(
      '--base debe ser una URL, p. ej. http://localhost:3001/api.',
    );
  }
  const produccion = flags.has('--produccion');
  if (!isLocalBase(base) && !produccion) {
    throw new CargaUsageError(
      `La base ${base} no es local. Para correr contra otra API pasa --produccion, y hazlo sin nadie conectado.`,
    );
  }
  return {
    clientes,
    minutos: positive('--minutos', values.get('--minutos') ?? '5'),
    escenario,
    pulsos,
    historial: flags.has('--historial'),
    ciclo: positive('--ciclo', values.get('--ciclo') ?? '60'),
    espera,
    base,
    produccion,
    forzar: flags.has('--forzar'),
    json: values.get('--json') ?? null,
  };
};
