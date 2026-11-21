export type CellValue = string | number | boolean | null;

export type Grid = readonly (readonly CellValue[])[];

export interface SheetTab {
  readonly title: string;
  readonly rows: Grid;
}

export interface SheetSnapshot {
  readonly tabs: readonly SheetTab[];
}

export interface CellChange {
  readonly locator: string;
  readonly before: CellValue;
  readonly after: CellValue;
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

const valueAt = (rows: Grid, row: number, column: number): CellValue => {
  const value = rows[row]?.[column];
  return value === undefined || value === '' ? null : value;
};

const diffTab = (title: string, before: Grid, after: Grid): CellChange[] => {
  const changes: CellChange[] = [];
  const height = Math.max(before.length, after.length);
  for (let row = 0; row < height; row += 1) {
    const width = Math.max(before[row]?.length ?? 0, after[row]?.length ?? 0);
    for (let column = 0; column < width; column += 1) {
      const was = valueAt(before, row, column);
      const is = valueAt(after, row, column);
      if (was !== is) {
        changes.push({
          locator: cellLocator(title, column, row),
          before: was,
          after: is,
        });
      }
    }
  }
  return changes;
};

export const diffSnapshots = (
  before: SheetSnapshot,
  after: SheetSnapshot,
): CellChange[] => {
  const previous = new Map(before.tabs.map((tab) => [tab.title, tab.rows]));
  const current = new Map(after.tabs.map((tab) => [tab.title, tab.rows]));
  const titles = [
    ...after.tabs.map((tab) => tab.title),
    ...before.tabs
      .map((tab) => tab.title)
      .filter((title) => !current.has(title)),
  ];
  return titles.flatMap((title) =>
    diffTab(title, previous.get(title) ?? [], current.get(title) ?? []),
  );
};
