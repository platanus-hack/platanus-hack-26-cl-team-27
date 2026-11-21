import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CARGA_INICIAL, PASOS } from '../src/guion.ts';
import { readLake } from '../src/pipeline.ts';
import type { Claim } from '../src/types.ts';

interface GoldenRevision {
  documentId: string;
  label: string;
  pointer: string;
  claims: Claim[];
}

interface GoldenSeeded extends GoldenRevision {
  authorId: string;
}

interface GoldenFixture extends GoldenRevision {
  id: string;
  seat: string;
  spaceId: string;
}

interface Golden {
  spaces: { id: string; ownerId: string }[];
  documents: { id: string; spaceId: string; ownerId: string }[];
  seeded: GoldenSeeded[];
  fixtures: GoldenFixture[];
  scenes: {
    id: string;
    label: string;
    hint: string;
    extra: boolean;
    fixtureIds: string[];
  }[];
  autoplayChain: string[];
}

const golden: Golden = JSON.parse(
  readFileSync(join(import.meta.dirname, 'golden-catalog.json'), 'utf8'),
);
const lake = readLake();

const find = (documentId: string, label: string) => {
  const found = lake.filter(
    (item) =>
      item.revision.documentId === documentId && item.revision.label === label,
  );
  expect(found, `${documentId} ${label}`).toHaveLength(1);
  return found[0]!;
};

describe('lago contra la foto de oro', () => {
  it.each(
    golden.seeded.map(
      (seed) => [`${seed.documentId} ${seed.label}`, seed] as const,
    ),
  )('la revisión sembrada %s sale idéntica', (_name, seed) => {
    const { revision } = find(seed.documentId, seed.label);
    const document = golden.documents.find(
      (doc) => doc.id === seed.documentId,
    )!;
    expect(revision.spaceId).toBe(document.spaceId);
    expect(revision.authorId).toBe(seed.authorId);
    expect(revision.pointer).toBe(seed.pointer);
    expect(revision.claims).toEqual(seed.claims);
  });

  it.each(golden.fixtures.map((fixture) => [fixture.id, fixture] as const))(
    'el fixture %s sale idéntico',
    (_id, fixture) => {
      const { revision } = find(fixture.documentId, fixture.label);
      expect(revision.spaceId).toBe(fixture.spaceId);
      expect(revision.authorId).toBe(fixture.seat);
      expect(revision.pointer).toBe(fixture.pointer);
      expect(revision.claims).toEqual(fixture.claims);
    },
  );

  it('el lago tiene exactamente las revisiones de la foto de oro', () => {
    expect(lake).toHaveLength(golden.seeded.length + golden.fixtures.length);
  });

  it('cada archivo lleva su sha256', () => {
    for (const item of lake) {
      expect(item.revision.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('el guion repite escenas y cadena de la foto de oro', () => {
    expect(PASOS.map((paso) => paso.id)).toEqual(golden.autoplayChain);
    for (const scene of golden.scenes) {
      const paso = PASOS.find((candidate) => candidate.id === scene.id)!;
      expect(paso.title).toBe(scene.label);
      expect(paso.hint).toBe(scene.hint);
      expect(paso.extra).toBe(scene.extra);
      const fixtures = scene.fixtureIds.map((id) =>
        golden.fixtures.find((fixture) => fixture.id === id)!,
      );
      const loaded = paso.files.map(
        (path) =>
          lake.find((item) => item.file.relativePath === path)!.revision,
      );
      expect(loaded.map((rev) => [rev.documentId, rev.label])).toEqual(
        fixtures.map((fixture) => [fixture.documentId, fixture.label]),
      );
      const requires = fixtures.flatMap(
        (fixture) =>
          (
            fixture as unknown as {
              requires: { documentId: string; label: string }[];
            }
          ).requires,
      );
      expect(paso.requires).toEqual(
        requires.filter(
          (ref, index) =>
            requires.findIndex(
              (other) =>
                other.documentId === ref.documentId &&
                other.label === ref.label,
            ) === index,
        ),
      );
    }
  });

  it('la carga inicial son las nueve revisiones sembradas, en orden', () => {
    const loaded = CARGA_INICIAL.map(
      (path) => lake.find((item) => item.file.relativePath === path)!.revision,
    );
    expect(loaded.map((rev) => [rev.documentId, rev.label])).toEqual(
      golden.seeded.map((seed) => [seed.documentId, seed.label]),
    );
  });
});
