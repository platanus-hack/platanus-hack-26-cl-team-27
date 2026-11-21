import { extractLake } from './extract/index.ts';
import { transformAll } from './transform/index.ts';
import type { Extracted } from './types.ts';

export const readLake = (dir?: string): Extracted[] =>
  transformAll(extractLake(dir));

export const indexByPath = (
  items: readonly Extracted[],
): ReadonlyMap<string, Extracted> =>
  new Map(items.map((item) => [item.file.relativePath, item]));
