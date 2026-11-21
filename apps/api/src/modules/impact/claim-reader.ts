import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ClaimReader } from '@team27/context-impact';
import {
  anthropicClient,
  CachedClaimReader,
  ClaudeClaimReader,
  FileResponseCache,
  FixtureClaimReader,
} from '@team27/context-impact/adapters';

import { SAMPLE_CLAIM_FIXTURES } from './fixtures.ts';

export const CACHE_FOLDER = 'inference-cache';

export const apiRoot = (from: string = import.meta.url): string => {
  let directory = dirname(fileURLToPath(from));
  while (!existsSync(join(directory, 'package.json'))) {
    const parent = dirname(directory);
    if (parent === directory) return process.cwd();
    directory = parent;
  }
  return directory;
};

export const defaultCacheDirectory = (): string =>
  join(apiRoot(), CACHE_FOLDER);

export interface ClaimReaderChoice {
  readonly reader: ClaimReader;
  readonly mode: 'claude' | 'fixtures';
}

export const chooseClaimReader = (
  apiKey: string | undefined,
  cacheDirectory: string = defaultCacheDirectory(),
): ClaimReaderChoice => {
  const cache = new FileResponseCache(cacheDirectory);
  if (apiKey !== undefined && apiKey.trim() !== '') {
    return {
      mode: 'claude',
      reader: new CachedClaimReader(
        new ClaudeClaimReader(anthropicClient(apiKey)),
        cache,
        'claude',
      ),
    };
  }
  return {
    mode: 'fixtures',
    reader: new CachedClaimReader(
      new FixtureClaimReader(SAMPLE_CLAIM_FIXTURES),
      cache,
      'fixtures',
    ),
  };
};
