import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AffectedEstimator,
  AffectedQuery,
} from '../../application/ports/AffectedEstimator.ts';
import type {
  ClaimQuery,
  ClaimReader,
} from '../../application/ports/ClaimReader.ts';
import type { DependencyScorer } from '../../application/ports/DependencyScorer.ts';
import type { AffectedEstimate } from '../../domain/AffectedSuggestion.ts';
import type { DependencyScore } from '../../domain/DependencyScore.ts';
import type { ClaimCandidate } from '../../domain/ExtractedClaim.ts';
import { stableStringify } from '../../domain/stableStringify.ts';

export interface ResponseCache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export const cacheKey = (namespace: string, query: unknown): string =>
  createHash('sha256')
    .update(`${namespace}\n${stableStringify(query)}`)
    .digest('hex');

export class MemoryResponseCache implements ResponseCache {
  private readonly entries = new Map<string, unknown>();

  get(key: string): Promise<unknown> {
    return Promise.resolve(this.entries.get(key));
  }

  set(key: string, value: unknown): Promise<void> {
    this.entries.set(key, value);
    return Promise.resolve();
  }
}

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

export class FileResponseCache implements ResponseCache {
  private readonly directory: string;

  constructor(directory: string) {
    this.directory = directory;
  }

  async get(key: string): Promise<unknown> {
    try {
      return JSON.parse(await readFile(this.pathOf(key), 'utf8')) as unknown;
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.pathOf(key), `${JSON.stringify(value, null, 2)}\n`);
  }

  private pathOf(key: string): string {
    return join(this.directory, `${key}.json`);
  }
}

const throughCache = async <T>(
  cache: ResponseCache,
  key: string,
  compute: () => Promise<T>,
): Promise<T> => {
  const hit = await cache.get(key);
  if (hit !== undefined) return hit as T;
  const result = await compute();
  await cache.set(key, result);
  return result;
};

export class CachedAffectedEstimator implements AffectedEstimator {
  private readonly inner: AffectedEstimator;
  private readonly cache: ResponseCache;
  private readonly namespace: string;

  constructor(
    inner: AffectedEstimator,
    cache: ResponseCache,
    namespace: string,
  ) {
    this.inner = inner;
    this.cache = cache;
    this.namespace = namespace;
  }

  estimate(query: AffectedQuery): Promise<AffectedEstimate[]> {
    return throughCache(
      this.cache,
      cacheKey(`affected:${this.namespace}`, query),
      () => this.inner.estimate(query),
    );
  }
}

export class CachedClaimReader implements ClaimReader {
  private readonly inner: ClaimReader;
  private readonly cache: ResponseCache;
  private readonly namespace: string;

  constructor(inner: ClaimReader, cache: ResponseCache, namespace: string) {
    this.inner = inner;
    this.cache = cache;
    this.namespace = namespace;
  }

  read(query: ClaimQuery): Promise<ClaimCandidate[]> {
    return throughCache(
      this.cache,
      cacheKey(`claims:${this.namespace}`, query),
      () => this.inner.read(query),
    );
  }
}

export class CachedDependencyScorer implements DependencyScorer {
  private readonly inner: DependencyScorer;
  private readonly cache: ResponseCache;
  private readonly namespace: string;

  constructor(
    inner: DependencyScorer,
    cache: ResponseCache,
    namespace: string,
  ) {
    this.inner = inner;
    this.cache = cache;
    this.namespace = namespace;
  }

  score(query: AffectedQuery): Promise<DependencyScore[]> {
    return throughCache(
      this.cache,
      cacheKey(`scores:${this.namespace}`, query),
      () => this.inner.score(query),
    );
  }
}
