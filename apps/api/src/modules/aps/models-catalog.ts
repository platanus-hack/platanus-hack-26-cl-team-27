import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { apiRoot } from '../../common/api-root.ts';

export const DISCIPLINES = [
  'architectural',
  'site',
  'structural',
  'plumbing',
  'hvac',
  'electrical',
] as const;

export type Discipline = (typeof DISCIPLINES)[number] | 'other';

export type TranslationStatus =
  'pending' | 'inprogress' | 'success' | 'failed' | 'timeout';

export interface CatalogModel {
  readonly file: string;
  readonly discipline: Discipline;
  readonly objectKey: string;
  readonly size: number;
  readonly urn: string;
  readonly status: TranslationStatus;
  readonly messages: readonly string[];
  readonly updatedAt: string;
}

export interface ModelsCatalog {
  readonly bucketKey: string;
  readonly region: string;
  readonly models: readonly CatalogModel[];
}

export const MODELS_DIR = join(apiRoot(), 'models');

export const CATALOG_PATH = join(MODELS_DIR, 'models.json');

export const disciplineOf = (file: string): Discipline => {
  const name = file.toLowerCase();
  if (name.includes('arch')) return 'architectural';
  if (name.includes('site')) return 'site';
  if (name.includes('struct')) return 'structural';
  if (name.includes('plumb')) return 'plumbing';
  if (name.includes('hvac') || name.includes('mech')) return 'hvac';
  if (name.includes('elec')) return 'electrical';
  return 'other';
};

export const toUrn = (objectId: string): string =>
  Buffer.from(objectId).toString('base64url');

export const readCatalog = async (
  path: string = CATALOG_PATH,
): Promise<ModelsCatalog | null> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as ModelsCatalog;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};
