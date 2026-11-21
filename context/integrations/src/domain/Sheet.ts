export type CellValue = string | number | boolean | null;

export type Grid = readonly (readonly CellValue[])[];

export interface SheetTab {
  readonly title: string;
  readonly rows: Grid;
}

export const columnLetter = (index: number): string => {
  let rest = index + 1;
  let letters = '';
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    rest = Math.floor((rest - 1) / 26);
  }
  return letters;
};

export const cellLocator = (
  sheetTitle: string,
  column: number,
  row: number,
): string => `${sheetTitle}!${columnLetter(column)}${row + 1}`;

export const cellText = (value: CellValue | undefined): string =>
  value === null || value === undefined ? '' : String(value).trim();

export const parseLocaleNumber = (text: string): number | null => {
  const clean = text.replace(/[\s$]/g, '');
  if (clean === '') return null;
  let normal = clean;
  if (clean.includes(',')) normal = clean.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) normal = clean.replace(/\./g, '');
  const value = Number(normal);
  return Number.isFinite(value) ? value : null;
};

export const cellNumber = (value: CellValue | undefined): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return null;
  return parseLocaleNumber(cellText(value));
};

export const normalizeWords = (text: string): string[] =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '');
