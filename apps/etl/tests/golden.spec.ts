import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CARGA_INICIAL, PASOS } from '../src/guion.ts';
import { claimsOf, isTextChunk } from '../src/load/index.ts';
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
const freeText: Record<string, Claim[]> = JSON.parse(
  readFileSync(join(import.meta.dirname, 'free-text-claims.json'), 'utf8'),
);
const lake = readLake();

const FREE_TEXT_DOCUMENTS: ReadonlySet<string> = new Set([
  'whatsapp',
  'libro',
  'acta',
]);
const isFreeText = (documentId: string): boolean =>
  FREE_TEXT_DOCUMENTS.has(documentId);

const CHANGED_HINTS: ReadonlySet<string> = new Set(['x2']);
const IS301_REV_A = 'drive-proyecto/IS-301_revA.json';

const sameClaimWithoutLocator = (claim: Claim) => ({
  ...claim,
  locator: undefined,
});

const expectRevision = (
  revision: ReturnType<typeof find>['revision'],
  expected: Claim[],
) => {
  if (!isFreeText(revision.documentId)) {
    expect(revision.chunks.some(isTextChunk)).toBe(false);
    expect(claimsOf(revision)).toEqual(expected);
    return;
  }
  expect(revision.chunks.every(isTextChunk)).toBe(true);
  const fixture = freeText[`${revision.documentId} ${revision.label}`]!;
  expect(fixture, 'falta el fixture de texto libre').toBeDefined();
  expect(fixture.map(sameClaimWithoutLocator)).toEqual(
    expected.map(sameClaimWithoutLocator),
  );
  const locators = new Set(revision.chunks.map((chunk) => chunk.locator));
  for (const claim of fixture) expect(locators.has(claim.locator)).toBe(true);
};

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
    expectRevision(revision, seed.claims);
  });

  it.each(golden.fixtures.map((fixture) => [fixture.id, fixture] as const))(
    'el fixture %s sale idéntico',
    (_id, fixture) => {
      const { revision } = find(fixture.documentId, fixture.label);
      expect(revision.spaceId).toBe(fixture.spaceId);
      expect(revision.authorId).toBe(fixture.seat);
      expect(revision.pointer).toBe(fixture.pointer);
      expectRevision(revision, fixture.claims);
    },
  );

  it('el lago tiene exactamente las revisiones de la foto de oro', () => {
    expect(lake).toHaveLength(
      golden.seeded.length + golden.fixtures.length + 2,
    );
  });

  it('cada archivo lleva su sha256', () => {
    for (const item of lake) {
      expect(item.revision.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('el guion repite escenas y cadena de la foto de oro', () => {
    expect(PASOS.map((paso) => paso.id)).toEqual([
      's1',
      's2',
      's3',
      's4',
      'x1',
      'x2',
      'x3',
      's5',
      's6',
    ]);
    expect(
      PASOS.filter((paso) => paso.id !== 'x3').map((paso) => paso.id),
    ).toEqual(golden.autoplayChain);
    for (const scene of golden.scenes) {
      const paso = PASOS.find((candidate) => candidate.id === scene.id)!;
      expect(paso.title).toBe(scene.label);
      if (!CHANGED_HINTS.has(scene.id)) expect(paso.hint).toBe(scene.hint);
      else expect(paso.hint.startsWith(scene.hint)).toBe(true);
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

  it('la carga inicial son las nueve revisiones sembradas y el IS-301 rev A, en orden', () => {
    const loaded = CARGA_INICIAL.map(
      (path) => lake.find((item) => item.file.relativePath === path)!.revision,
    );
    expect(loaded.map((rev) => [rev.documentId, rev.label])).toEqual([
      ...golden.seeded.map((seed) => [seed.documentId, seed.label]),
      ['is301', 'rev A'],
    ]);
    expect(CARGA_INICIAL.at(-1)).toBe(IS301_REV_A);
  });

  it('el paso x3 carga el IS-301 rev B después del A-201 rev D', () => {
    const paso = PASOS.find((candidate) => candidate.id === 'x3')!;
    expect(paso.title).toBe('Javier mueve el colector B2');
    expect(paso.files).toEqual(['drive-proyecto/IS-301_revB.json']);
    expect(paso.requires).toEqual([{ documentId: 'a201', label: 'rev D' }]);
  });
});

describe('fragmentos de texto libre', () => {
  const textOf = (documentId: string, label: string) =>
    find(documentId, label).revision.chunks.map((chunk) => ({
      locator: chunk.locator,
      kind: chunk.kind,
      text: chunk.text,
      claims: chunk.claims,
    }));

  it('el chat manda un fragmento por mensaje, sin hechos', () => {
    const greeting = {
      locator: 'mensaje de las 08:05',
      kind: 'mensaje',
      text: 'Buenos días equipo, hoy hormigonamos la losa del nivel 2. Los camiones llegan a las 9.',
      claims: undefined,
    };
    expect(textOf('whatsapp', 'mensaje 1')).toEqual([greeting]);
    expect(textOf('whatsapp', 'mensaje 2')).toEqual([
      greeting,
      {
        locator: 'mensaje de las 14:32',
        kind: 'mensaje',
        text: 'Ojo con esto: las ventanas del norte quedaron en 150 cm de ancho, ya lo hablé con el proveedor.',
        claims: undefined,
      },
    ]);
  });

  it('cada folio es un fragmento de anotación', () => {
    expect(textOf('libro', 'folio 41')).toEqual([
      {
        locator: 'folio 41',
        kind: 'anotacion',
        text: 'Se verifica el replanteo de las instalaciones del nivel 1 con topografía. Shaft S1 replanteado a 6,0 m del eje A, conforme al plano A-201 rev B. Sin observaciones de la ITO.',
        claims: undefined,
      },
    ]);
    expect(textOf('libro', 'folio 44')).toEqual([
      {
        locator: 'folio 44',
        kind: 'anotacion',
        text: 'Por interferencia con la armadura de la viga V-12 del nivel 1, el shaft S1 se corre a 8,5 m del eje A. Se informa a la arquitecta para que emita la revisión del plano A-201.',
        claims: undefined,
      },
    ]);
  });

  it('el acta manda un fragmento por acuerdo', () => {
    const chunks = textOf('acta', 'N° 12');
    expect(chunks.map((chunk) => chunk.locator)).toEqual([
      'acuerdo 1',
      'acuerdo 2',
      'acuerdo 3',
      'acuerdo 4',
      'acuerdo 5',
    ]);
    expect(chunks.every((chunk) => chunk.kind === 'acuerdo')).toBe(true);
    expect(chunks[3]?.text).toBe(
      'Se mantiene el plazo de entrega de la obra en 108 días corridos desde el inicio de faenas.',
    );
    expect(chunks.every((chunk) => chunk.claims === undefined)).toBe(true);
  });

  it('el fixture de hechos esperados cubre cada documento de texto libre', () => {
    const documents = lake
      .filter((item) => isFreeText(item.revision.documentId))
      .map((item) => `${item.revision.documentId} ${item.revision.label}`);
    expect(Object.keys(freeText).sort()).toEqual([...documents].sort());
  });
});
