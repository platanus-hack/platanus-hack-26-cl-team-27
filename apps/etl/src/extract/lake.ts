import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ParseError, type RawFile, type SourceKind } from '../types.ts';
import { SPACE_FOLDERS } from '../vocabulary.ts';

export const LAKE_DIR = join(import.meta.dirname, '..', '..', 'lago');

const MANIFEST = 'origen.json';

const KINDS: ReadonlySet<string> = new Set([
  'plano',
  'eett',
  'presupuesto',
  'gantt',
  'cotizacion',
  'acta',
  'whatsapp',
  'libro',
]);

interface Origin {
  readonly pointer: string;
  readonly kind: SourceKind;
}

const readOrigins = (dir: string, folder: string): Map<string, Origin> => {
  const path = join(dir, folder, MANIFEST);
  const origins = new Map<string, Origin>();
  let manifest: Record<string, { pointer?: unknown; tipo?: unknown }>;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new ParseError(
      `${folder}/${MANIFEST}`,
      'no se pudo leer el origen de los archivos',
    );
  }
  for (const [name, entry] of Object.entries(manifest)) {
    if (
      typeof entry.pointer !== 'string' ||
      typeof entry.tipo !== 'string' ||
      !KINDS.has(entry.tipo)
    ) {
      throw new ParseError(
        `${folder}/${MANIFEST}`,
        `entrada inválida para ${name}`,
      );
    }
    origins.set(name, {
      pointer: entry.pointer,
      kind: entry.tipo as SourceKind,
    });
  }
  return origins;
};

export const extractLake = (dir: string = LAKE_DIR): RawFile[] => {
  const files: RawFile[] = [];
  for (const [folder, spaceId] of Object.entries(SPACE_FOLDERS)) {
    const origins = readOrigins(dir, folder);
    const names = readdirSync(join(dir, folder))
      .filter((name) => name !== MANIFEST)
      .sort();
    for (const name of names) {
      const origin = origins.get(name);
      if (origin === undefined) {
        throw new ParseError(
          `${folder}/${name}`,
          `no está declarado en ${MANIFEST}`,
        );
      }
      const buffer = readFileSync(join(dir, folder, name));
      files.push({
        folder,
        spaceId,
        name,
        relativePath: `${folder}/${name}`,
        kind: origin.kind,
        pointer: origin.pointer,
        text: buffer.toString('utf8'),
        sha256: createHash('sha256').update(buffer).digest('hex'),
      });
    }
  }
  return files;
};
