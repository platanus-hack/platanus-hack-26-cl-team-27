import {
  ParseError,
  type Claim,
  type RawFile,
  type Revision,
} from '../types.ts';
import { budgetSubject, parseNumber } from '../vocabulary.ts';
import {
  finish,
  requireDocument,
  requirePerson,
  requireText,
} from './common.ts';
import { cell, columnLetter, headerRow, metaValue, parseCsv } from './csv.ts';
import { designClaim } from './design.ts';

export const parsePresupuesto = (file: RawFile): Revision => {
  const table = parseCsv(file.text);
  const header = headerRow(table, 'Código');
  if (header === null) {
    throw new ParseError(
      file.relativePath,
      'falta la fila de encabezados «Código»',
    );
  }
  const sheet = requireText(file, metaValue(table, 'Hoja'), 'la hoja');
  const price = header.columns['precio unitario'];
  const unit = header.columns['unidad'];
  const design = header.columns['dimensión de diseño usada'];
  if (price === undefined || unit === undefined) {
    throw new ParseError(
      file.relativePath,
      'faltan las columnas de precio y unidad',
    );
  }
  const prices: Claim[] = [];
  const uses: Claim[] = [];
  for (let row = header.row + 1; row < table.length; row += 1) {
    const subject = budgetSubject(cell(table, row, 0));
    if (subject === null) continue;
    const value = parseNumber(cell(table, row, price));
    if (value === null) continue;
    prices.push({
      subject,
      attribute: 'precio_unitario',
      value,
      unit: `$/${cell(table, row, unit)}`,
      role: 'afirma',
      locator: `${sheet}!${columnLetter(price)}${row + 1}`,
    });
    if (design !== undefined) {
      const used = designClaim(
        cell(table, row, design),
        `${sheet}!${columnLetter(design)}${row + 1}`,
      );
      if (used) uses.push(used);
    }
  }
  return finish(file, {
    documentId: requireDocument(file, table[0]?.[0] ?? null),
    label: requireText(file, metaValue(table, 'Versión'), 'la versión'),
    authorId: requirePerson(file, metaValue(table, 'Elaboró')),
    claims: [...prices, ...uses],
  });
};
