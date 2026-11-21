import { parseArgs as parseFlags } from 'node:util';

export type Command =
  | { readonly name: 'check' }
  | {
      readonly name: 'models';
      readonly force: boolean;
      readonly folder: string | null;
    };

export const USAGE = `Uso:
  pnpm aps:check                                 prueba las credenciales y el bucket de APS
  pnpm aps:models [--force] [--carpeta <ruta>]   sube y traduce a SVF2 los .rvt de apps/aps/models (o de <ruta>)`;

export class UsageError extends Error {}

const flagsOf = (argv: readonly string[]) => {
  try {
    return parseFlags({
      args: [...argv],
      allowPositionals: true,
      options: {
        force: { type: 'boolean', default: false },
        carpeta: { type: 'string' },
      },
    });
  } catch (error) {
    throw new UsageError(
      `No entiendo las opciones (${error instanceof Error ? error.message : String(error)})`,
    );
  }
};

export const parseArgs = (argv: readonly string[]): Command => {
  const { values, positionals } = flagsOf(argv);
  const [name, ...rest] = positionals;
  if (rest.length > 0) throw new UsageError(`Sobra: ${rest.join(' ')}`);
  if (name === 'check') {
    if (values.force || values.carpeta !== undefined) {
      throw new UsageError('check no lleva opciones');
    }
    return { name };
  }
  if (name === 'models') {
    return { name, force: values.force, folder: values.carpeta ?? null };
  }
  throw new UsageError(
    name ? `No conozco el comando ${name}` : 'Falta el comando',
  );
};
