import {
  ParseError,
  type Claim,
  type RawFile,
  type Revision,
} from '../types.ts';
import { ATTRIBUTE_UNITS, subjectOf } from '../vocabulary.ts';
import {
  finish,
  structuredChunks,
  requireDocument,
  requirePerson,
  requireText,
} from './common.ts';

type Json = Record<string, unknown>;

const asRecord = (file: RawFile, value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ParseError(file.relativePath, `${what} no es un objeto`);
  }
  return value as Json;
};

const asList = (file: RawFile, value: unknown, what: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new ParseError(file.relativePath, `${what} no es una lista`);
  }
  return value;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

export const parsePlano = (file: RawFile): Revision => {
  let root: Json;
  try {
    root = asRecord(file, JSON.parse(file.text), 'el plano');
  } catch (error) {
    if (error instanceof ParseError) throw error;
    throw new ParseError(file.relativePath, 'no es un JSON válido');
  }
  const stamp = asRecord(file, root['rotulo'], 'el cuadro de rotulación');
  const claims: Claim[] = [];
  for (const raw of asList(file, root['cuadros'], 'los cuadros')) {
    const table = asRecord(file, raw, 'un cuadro');
    const title = requireText(
      file,
      text(table['titulo']),
      'el título del cuadro',
    );
    const rows = asList(
      file,
      table['elementos'],
      `los elementos de «${title}»`,
    );
    for (const rawRow of rows) {
      const row = asRecord(file, rawRow, 'un elemento');
      const name = requireText(
        file,
        text(row['elemento']),
        'el nombre del elemento',
      );
      const subject = subjectOf(name);
      if (subject === null) continue;
      const locator = rows.length > 1 ? `${title} · ${name}` : title;
      for (const [key, value] of Object.entries(row)) {
        if (!Object.hasOwn(ATTRIBUTE_UNITS, key)) continue;
        if (typeof value !== 'number' && typeof value !== 'string') continue;
        claims.push({
          subject,
          attribute: key,
          value,
          unit: ATTRIBUTE_UNITS[key] ?? null,
          role: 'afirma',
          locator,
        });
      }
    }
  }
  return finish(file, {
    documentId: requireDocument(file, text(stamp['documento'])),
    label: requireText(file, text(stamp['revision']), 'la revisión'),
    authorId: requirePerson(file, text(stamp['autor'])),
    chunks: structuredChunks(claims, 'fila'),
  });
};
