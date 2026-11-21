import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AffectedEstimator } from '../../src/application/ports/AffectedEstimator.ts';
import type { ClaimReader } from '../../src/application/ports/ClaimReader.ts';
import {
  CachedAffectedEstimator,
  CachedClaimReader,
  cacheKey,
  FileResponseCache,
  MemoryResponseCache,
} from '../../src/infra/adapters/Cached.ts';
import { slabChange, vocabulary } from '../support.ts';

const query = {
  change: slabChange,
  vocabulary,
  candidates: vocabulary.stakeholders,
  evidence: [],
};

const estimates = [
  {
    stakeholderId: 'camila',
    probability: 0.72,
    reason: 'razón',
    evidence: 'sin evidencia directa',
    question: '¿Te afecta?',
  },
];

const innerEstimator = () => ({
  estimate: vi.fn<AffectedEstimator['estimate']>(() =>
    Promise.resolve(estimates),
  ),
});

describe('cacheKey', () => {
  it('no depende del orden de las llaves y sí del espacio de nombres', () => {
    expect(cacheKey('a', { x: 1, y: 2 })).toBe(cacheKey('a', { y: 2, x: 1 }));
    expect(cacheKey('a', { x: 1 })).not.toBe(cacheKey('b', { x: 1 }));
  });
});

describe('CachedAffectedEstimator', () => {
  it('consulta al modelo una sola vez por consulta idéntica', async () => {
    const inner = innerEstimator();
    const cached = new CachedAffectedEstimator(
      inner,
      new MemoryResponseCache(),
      'claude-opus-5-5',
    );

    const first = await cached.estimate(query);
    const second = await cached.estimate({ ...query });

    expect(first).toEqual(estimates);
    expect(second).toEqual(estimates);
    expect(inner.estimate).toHaveBeenCalledTimes(1);
  });

  it('vuelve a consultar si cambia la consulta', async () => {
    const inner = innerEstimator();
    const cached = new CachedAffectedEstimator(
      inner,
      new MemoryResponseCache(),
      'claude-opus-5-5',
    );

    await cached.estimate(query);
    await cached.estimate({ ...query, change: { ...slabChange, after: 25 } });

    expect(inner.estimate).toHaveBeenCalledTimes(2);
  });
});

describe('FileResponseCache', () => {
  let directory = '';

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'inference-cache-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reproduce entre procesos lo que el modelo respondió la primera vez', async () => {
    const inner = {
      read: vi.fn<ClaimReader['read']>(() => Promise.resolve([])),
    };
    const claimQuery = {
      evidence: {
        kind: 'text' as const,
        source: 'mensaje' as const,
        title: 'WhatsApp',
        text: 'hola',
      },
      vocabulary,
    };

    await new CachedClaimReader(
      inner,
      new FileResponseCache(directory),
      'm',
    ).read(claimQuery);
    await new CachedClaimReader(
      inner,
      new FileResponseCache(directory),
      'm',
    ).read(claimQuery);

    expect(inner.read).toHaveBeenCalledTimes(1);
    expect(await readdir(directory)).toHaveLength(1);
  });

  it('devuelve undefined si no hay entrada', async () => {
    expect(await new FileResponseCache(directory).get('nada')).toBeUndefined();
  });
});
