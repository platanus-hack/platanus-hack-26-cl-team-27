import {
  cellLocator,
  cellNumber,
  cellText,
  normalizeWords,
  parseLocaleNumber,
  type SheetTab,
} from './Sheet.ts';
import {
  attributeOf,
  matchAttribute,
  matchSubject,
  type SourceVocabulary,
  subjectById,
} from './Vocabulary.ts';

export type ClaimRole = 'afirma' | 'usa';

export interface SourceClaim {
  readonly subject: string;
  readonly attribute: string;
  readonly value: number;
  readonly unit: string | null;
  readonly role: ClaimRole;
  readonly locator: string;
}

export interface SourceChunk {
  readonly locator: string;
  readonly kind: 'fila';
  readonly claims: readonly SourceClaim[];
}

export interface IgnoredCell {
  readonly locator: string;
  readonly reason: string;
}

export interface SheetReading {
  readonly chunks: readonly SourceChunk[];
  readonly ignored: readonly IgnoredCell[];
}

export class SheetFormatError extends Error {
  override readonly name = 'SheetFormatError';
}

export const PRICE_ATTRIBUTE = 'precio_unitario';

const BUDGET_SUBJECT_PREFIX = 'partida-';

const HEADERS = {
  code: 'codigo',
  price: 'precio unitario',
  unit: 'unidad',
  design: 'dimension de diseno usada',
} as const;

const headerKey = (text: string): string => normalizeWords(text).join(' ');

interface Header {
  readonly row: number;
  readonly code: number;
  readonly price: number;
  readonly unit: number;
  readonly design: number | null;
}

const findHeader = (tab: SheetTab): Header | null => {
  for (let row = 0; row < tab.rows.length; row += 1) {
    const keys = (tab.rows[row] ?? []).map((value) =>
      headerKey(cellText(value)),
    );
    const code = keys.indexOf(HEADERS.code);
    const price = keys.indexOf(HEADERS.price);
    const unit = keys.indexOf(HEADERS.unit);
    if (code >= 0 && price >= 0 && unit >= 0) {
      const design = keys.indexOf(HEADERS.design);
      return { row, code, price, unit, design: design >= 0 ? design : null };
    }
  }
  return null;
};

const normalizeUnit = (unit: string): string =>
  unit.replace(/\s/g, '').replace(/m3$/i, 'm³').replace(/m2$/i, 'm²');

const DIMENSION = /(\p{L}+)\s*:?\s*(\d[\d.,]*)/gu;

const designClaim = (
  vocabulary: SourceVocabulary,
  text: string,
  locator: string,
): SourceClaim | null => {
  const [subjectPart = '', dimensionPart = ''] = text.includes('·')
    ? text.split('·')
    : [text, text];
  const subject = matchSubject(vocabulary, subjectPart);
  if (subject === null) return null;
  for (const found of dimensionPart.matchAll(DIMENSION)) {
    const attribute = matchAttribute(subject, found[1] ?? '');
    const value = parseLocaleNumber(found[2] ?? '');
    if (attribute === null || value === null) continue;
    return {
      subject: subject.id,
      attribute: attribute.key,
      value,
      unit: attribute.unit,
      role: 'usa',
      locator,
    };
  }
  return null;
};

export const readBudgetSheet = (
  tab: SheetTab,
  vocabulary: SourceVocabulary,
): SheetReading => {
  const header = findHeader(tab);
  if (header === null) {
    throw new SheetFormatError(
      `La hoja «${tab.title}» no tiene la fila de encabezados con «Código», «Precio unitario» y «Unidad»`,
    );
  }
  const claims: SourceClaim[] = [];
  const ignored: IgnoredCell[] = [];
  for (let row = header.row + 1; row < tab.rows.length; row += 1) {
    const cells = tab.rows[row] ?? [];
    const code = cellText(cells[header.code]);
    if (code === '') continue;
    const codeLocator = cellLocator(tab.title, header.code, row);
    const subject = subjectById(vocabulary, `${BUDGET_SUBJECT_PREFIX}${code}`);
    const price = subject ? attributeOf(subject, PRICE_ATTRIBUTE) : null;
    if (subject === null || price === null) {
      ignored.push({
        locator: codeLocator,
        reason: `La obra no sigue la partida ${code}`,
      });
      continue;
    }
    const priceLocator = cellLocator(tab.title, header.price, row);
    const value = cellNumber(cells[header.price]);
    if (value === null) {
      ignored.push({
        locator: priceLocator,
        reason: `El precio de la partida ${code} no es un número`,
      });
      continue;
    }
    const sheetUnit = cellText(cells[header.unit]);
    const unit =
      sheetUnit === '' ? price.unit : `$/${normalizeUnit(sheetUnit)}`;
    if (price.unit !== null && unit !== price.unit) {
      ignored.push({
        locator: cellLocator(tab.title, header.unit, row),
        reason: `La partida ${code} va en ${price.unit}, no en ${unit}`,
      });
      continue;
    }
    claims.push({
      subject: subject.id,
      attribute: PRICE_ATTRIBUTE,
      value,
      unit,
      role: 'afirma',
      locator: priceLocator,
    });
    if (header.design === null) continue;
    const designText = cellText(cells[header.design]);
    if (designText === '') continue;
    const designLocator = cellLocator(tab.title, header.design, row);
    const used = designClaim(vocabulary, designText, designLocator);
    if (used) claims.push(used);
    else
      ignored.push({
        locator: designLocator,
        reason: `No reconocemos «${designText}» como una dimensión de la obra`,
      });
  }
  return {
    chunks: claims.map((claim) => ({
      locator: claim.locator,
      kind: 'fila',
      claims: [claim],
    })),
    ignored,
  };
};
