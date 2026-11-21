import {
  ParseError,
  type Claim,
  type RawFile,
  type Revision,
} from '../types.ts';
import { parseNumber, PROJECT_SUBJECT } from '../vocabulary.ts';
import {
  finish,
  requireDocument,
  requirePerson,
  requireText,
} from './common.ts';
import { cell, columnLetter, headerRow, metaValue, parseCsv } from './csv.ts';
import { designClaim } from './design.ts';

export const parseGantt = (file: RawFile): Revision => {
  const table = parseCsv(file.text);
  const header = headerRow(table, 'WBS');
  if (header === null) {
    throw new ParseError(
      file.relativePath,
      'falta la fila de encabezados «WBS»',
    );
  }
  const sheet = requireText(file, metaValue(table, 'Hoja'), 'la hoja');
  const activity = header.columns['actividad'];
  const assumption = header.columns['supuesto de diseño'];
  const duration = header.columns['duración (días)'];
  if (activity === undefined || duration === undefined) {
    throw new ParseError(
      file.relativePath,
      'faltan las columnas de actividad y duración',
    );
  }
  const delivery: Claim[] = [];
  const uses: Claim[] = [];
  for (let row = header.row + 1; row < table.length; row += 1) {
    if (/^entrega final\b/i.test(cell(table, row, activity))) {
      const days = parseNumber(cell(table, row, duration));
      if (days !== null) {
        delivery.push({
          subject: PROJECT_SUBJECT,
          attribute: 'entrega_dias',
          value: days,
          unit: 'días',
          role: 'afirma',
          locator: `${sheet}!${columnLetter(duration)}${row + 1}`,
        });
      }
    }
    if (assumption !== undefined) {
      const used = designClaim(
        cell(table, row, assumption),
        `${sheet}!${columnLetter(assumption)}${row + 1}`,
      );
      if (used) uses.push(used);
    }
  }
  return finish(file, {
    documentId: requireDocument(file, table[0]?.[0] ?? null),
    label: requireText(file, metaValue(table, 'Versión'), 'la versión'),
    authorId: requirePerson(file, metaValue(table, 'Programó')),
    claims: [...delivery, ...uses],
  });
};
