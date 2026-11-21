import {
  ParseError,
  type Claim,
  type RawFile,
  type Revision,
} from '../types.ts';
import {
  budgetSubject,
  parseNumber,
  subjectOf,
  ATTRIBUTE_UNITS,
} from '../vocabulary.ts';
import {
  finish,
  structuredChunks,
  requireDocument,
  requirePerson,
  requireText,
} from './common.ts';
import { cell, headerRow, metaValue, parseCsv } from './csv.ts';

export const parseCotizacion = (file: RawFile): Revision => {
  const table = parseCsv(file.text);
  const prices = headerRow(table, 'Código partida');
  const items = headerRow(table, 'Ítem');
  if (prices === null || items === null) {
    throw new ParseError(
      file.relativePath,
      'faltan la tabla de precios o la de ítems',
    );
  }
  const priceColumn = prices.columns['precio unitario'];
  const unitColumn = prices.columns['unidad'];
  const description = items.columns['descripción'];
  const planWidth = items.columns['ancho según plano (cm)'];
  const madeWidth = items.columns['ancho de fabricación (cm)'];
  if (
    priceColumn === undefined ||
    unitColumn === undefined ||
    description === undefined
  ) {
    throw new ParseError(file.relativePath, 'faltan columnas en la cotización');
  }
  const claims: Claim[] = [];
  for (let row = prices.row + 1; row < table.length; row += 1) {
    if ((table[row] ?? []).length === 0) break;
    const subject = budgetSubject(cell(table, row, 0));
    const value = parseNumber(cell(table, row, priceColumn));
    if (subject === null || value === null) continue;
    claims.push({
      subject,
      attribute: 'precio_unitario',
      value,
      unit: `$/${cell(table, row, unitColumn)}`,
      role: 'afirma',
      locator: 'tabla de precios',
    });
  }
  for (let row = items.row + 1; row < table.length; row += 1) {
    if ((table[row] ?? []).length === 0) break;
    const subject = subjectOf(cell(table, row, description));
    if (subject === null) continue;
    const locator = `ítem ${cell(table, row, 0)} · medidas`;
    const widths: readonly (readonly [number | undefined, 'afirma' | 'usa'])[] =
      [
        [madeWidth, 'afirma'],
        [planWidth, 'usa'],
      ];
    for (const [column, role] of widths) {
      if (column === undefined) continue;
      const value = parseNumber(cell(table, row, column));
      if (value === null) continue;
      claims.push({
        subject,
        attribute: 'ancho_cm',
        value,
        unit: ATTRIBUTE_UNITS['ancho_cm'] ?? null,
        role,
        locator,
      });
    }
  }
  return finish(file, {
    documentId: requireDocument(file, cell(table, 0, 1)),
    label: requireText(file, metaValue(table, 'Revisión'), 'la revisión'),
    authorId: requirePerson(file, metaValue(table, 'Proveedor')),
    chunks: structuredChunks(claims, 'fila'),
  });
};
