import { join } from 'node:path';

import type { ClaimReader } from '@team27/context-impact';
import {
  anthropicClient,
  CachedClaimReader,
  ClaudeClaimReader,
  FileResponseCache,
  FixtureClaimReader,
} from '@team27/context-impact/adapters';

import { apiRoot } from '../../common/api-root.ts';
import { SAMPLE_CLAIM_FIXTURES } from './fixtures.ts';

export const CACHE_FOLDER = 'inference-cache';

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
