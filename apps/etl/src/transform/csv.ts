export type Table = readonly (readonly string[])[];

const withoutBom = (text: string): string =>
  text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

export const parseCsv = (text: string): Table =>
  withoutBom(text)
    .split(/\r?\n/)
    .map((line) =>
      line === '' ? [] : line.split(';').map((cell) => cell.trim()),
    );

export const columnLetter = (index: number): string =>
  String.fromCharCode('A'.charCodeAt(0) + index);

export const cell = (table: Table, row: number, column: number): string =>
  table[row]?.[column] ?? '';

export const metaValue = (table: Table, key: string): string | null => {
  const wanted = key.toLowerCase();
  for (const row of table) {
    if (row.length >= 2 && row[0]?.toLowerCase() === wanted)
      return row[1] ?? '';
  }
  return null;
};

export const headerRow = (
  table: Table,
  firstCell: string,
): { row: number; columns: Readonly<Record<string, number>> } | null => {
  const wanted = firstCell.toLowerCase();
  const row = table.findIndex((cells) => cells[0]?.toLowerCase() === wanted);
  if (row < 0) return null;
  const columns: Record<string, number> = {};
  (table[row] ?? []).forEach((name, index) => {
    columns[name.toLowerCase()] = index;
  });
  return { row, columns };
};
