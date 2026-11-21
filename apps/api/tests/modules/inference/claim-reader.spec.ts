import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ExtractClaims,
  InferenceUnavailableError,
  type ClaimCandidate,
  type ClaimReader,
} from '@team27/context-inference';
import {
  CachedClaimReader,
  FileResponseCache,
  FixtureClaimReader,
} from '@team27/context-inference/adapters';
import type { ChunkDraft } from '@team27/context-lake';

import { ChunkReader } from '../../../src/modules/coordination/chunk-reader.ts';
import { documentOf } from '../../../src/scenario/documents.ts';
import { chooseClaimReader } from '../../../src/modules/inference/claim-reader.ts';
import { SAMPLE_CLAIM_FIXTURES } from '../../../src/modules/inference/fixtures.ts';
import { buildVocabulary } from '../../../src/modules/inference/vocabulary.ts';

const directories: string[] = [];

const tempDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'inference-cache-'));
  directories.push(directory);
  return directory;
};

afterAll(() => {
  for (const directory of directories) {
    rmSync(directory, { recursive: true, force: true });
  }
});

interface CatalogClaim {
  subject: string;
  attribute: string;
  value: number;
  unit: string | null;
  role: string;
}

interface Catalog {
  subjects: { id: string }[];
  seeded: { documentId: string; label: string; claims: CatalogClaim[] }[];
  fixtures: { documentId: string; label: string; claims: CatalogClaim[] }[];
}

const catalog = JSON.parse(
  readFileSync(
    new URL('../../../../etl/tests/golden-catalog.json', import.meta.url),
    'utf8',
  ),
) as Catalog;

const SAMPLE_TEXTS = [
  {
    documentId: 'whatsapp',
    label: 'mensaje 1',
    chunks: [
      'Buenos días equipo, hoy hormigonamos la losa del nivel 2. Los camiones llegan a las 9.',
    ],
  },
  {
    documentId: 'whatsapp',
    label: 'mensaje 2',
    chunks: [
      'Buenos días equipo, hoy hormigonamos la losa del nivel 2. Los camiones llegan a las 9.',
      'Ojo con esto: las ventanas del norte quedaron en 150 cm de ancho, ya lo hablé con el proveedor.',
    ],
  },
  {
    documentId: 'libro',
    label: 'folio 41',
    chunks: [
      'Se verifica el replanteo de las instalaciones del nivel 1 con topografía. Shaft S1 replanteado a 6,0 m del eje A, conforme al plano A-201 rev B. Sin observaciones de la ITO.',
    ],
  },
  {
    documentId: 'libro',
    label: 'folio 44',
    chunks: [
      'Por interferencia con la armadura de la viga V-12 del nivel 1, el shaft S1 se corre a 8,5 m del eje A. Se informa a la arquitecta para que emita la revisión del plano A-201.',
    ],
  },
  {
    documentId: 'acta',
    label: 'N° 12',
    chunks: [
      'Paula Rojas entrega la memoria de cálculo actualizada de las losas antes del viernes.',
      'Daniela Soto cierra el presupuesto itemizado v2 con los precios de hormigón y acero vigentes.',
      'Javier Muñoz y Camila Vera confirman el trazado de las redes por el shaft S1 antes del hormigonado del nivel 3.',
      'Se mantiene el plazo de entrega de la obra en 108 días corridos desde el inicio de faenas.',
      'Tomás Reyes coordina con Ventanas Quillay la cotización definitiva de las ventanas de la fachada norte.',
    ],
  },
] as const;

const factsOf = (claims: readonly CatalogClaim[]) =>
  claims.map(({ subject, attribute, value, unit, role }) => ({
    subject,
    attribute,
    value,
    unit,
    role,
  }));

describe('elección del lector de afirmaciones', () => {
  it.each([
    ['sin clave', undefined],
    ['con la clave vacía', ''],
    ['con la clave en blanco', '   '],
  ])('%s, la lectura es determinista y usa las respuestas fijas', (_name, key) => {
    expect(chooseClaimReader(key, tempDirectory()).mode).toBe('fixtures');
  });

  it('con una clave real usa a Claude', () => {
    expect(chooseClaimReader('sk-ant-prueba', tempDirectory()).mode).toBe(
      'claude',
    );
  });
});

describe('respuestas fijas de los textos libres de la muestra', () => {
  const vocabulary = buildVocabulary();
  const goldenFor = (documentId: string, label: string): CatalogClaim[] =>
    [...catalog.seeded, ...catalog.fixtures].find(
      (item) => item.documentId === documentId && item.label === label,
    )?.claims ?? [];

  it.each(SAMPLE_TEXTS)(
    'dan exactamente los hechos del catálogo de oro: $documentId $label',
    async ({ documentId, label, chunks }) => {
      const document = documentOf(documentId);
      const extract = new ExtractClaims(
        chooseClaimReader(undefined, tempDirectory()).reader,
      );
      const facts: CatalogClaim[] = [];
      for (const text of chunks) {
        const result = await extract.execute({
          evidence: {
            kind: 'text',
            source:
              document.kind === 'mensaje'
                ? 'mensaje'
                : document.kind === 'libro_obra'
                  ? 'libro_obra'
                  : 'documento',
            title: `${document.name} ${label}`,
            text,
          },
          vocabulary,
        });
        expect(result.rejected).toEqual([]);
        for (const claim of result.accepted) {
          expect(claim.confidence).toBeCloseTo(0.9, 5);
          facts.push({
            subject: claim.subject,
            attribute: claim.attribute,
            value: claim.value as number,
            unit: claim.unit,
            role: claim.role,
          });
        }
      }
      expect(factsOf(facts)).toEqual(factsOf(goldenFor(documentId, label)));
    },
  );

  it('cada hecho de texto libre del catálogo de oro tiene su respuesta fija', () => {
    const freeText = [...catalog.seeded, ...catalog.fixtures].filter(
      (item) => ['whatsapp', 'libro', 'acta'].includes(item.documentId),
    );
    const fixed = SAMPLE_CLAIM_FIXTURES.flatMap((fixture) => fixture.claims);
    for (const claim of freeText.flatMap((item) => item.claims)) {
      expect(
        fixed.some(
          (candidate) =>
            candidate.subject === claim.subject &&
            candidate.attribute === claim.attribute &&
            candidate.value === claim.value &&
            candidate.unit === claim.unit,
        ),
      ).toBe(true);
    }
  });

  it('el vocabulario conoce todos los sujetos del catálogo y el colector', () => {
    const ids = vocabulary.subjects.map((subject) => subject.id);
    for (const subject of catalog.subjects) expect(ids).toContain(subject.id);
    expect(ids).toContain('colector-b2');
    expect(
      vocabulary.subjects
        .find((subject) => subject.id === 'colector-b2')
        ?.attributes.map((attribute) => [attribute.key, attribute.unit]),
    ).toEqual([['posicion_m', 'm']]);
  });

  it('la caché graba la primera respuesta y la reproduce sin volver a leer', async () => {
    const directory = tempDirectory();
    const document = documentOf('libro');
    const query = {
      evidence: {
        kind: 'text' as const,
        source: 'libro_obra' as const,
        title: `${document.name} folio 44`,
        text: SAMPLE_TEXTS[3].chunks[0],
      },
      vocabulary,
    };
    const first = chooseClaimReader(undefined, directory).reader;
    const recorded = await first.read(query);
    expect(readdirSync(directory)).toHaveLength(1);

    const failing: ClaimReader = {
      read: () => Promise.reject(new Error('no debería leer')),
    };
    const replay = new CachedClaimReader(
      failing,
      new FileResponseCache(directory),
      'fixtures',
    );
    expect(await replay.read(query)).toEqual(recorded);
  });
});

describe('ChunkReader', () => {
  const candidate = (
    overrides: Partial<ClaimCandidate>,
  ): ClaimCandidate => ({
    subject: 'shaft-s1',
    attribute: 'posicion_m',
    value: 8.5,
    unit: 'm',
    role: 'afirma',
    locator: 'folio 44',
    confidence: 0.9,
    ...overrides,
  });

  const readerOf = (candidates: ClaimCandidate[]) =>
    new ChunkReader(
      new ExtractClaims(new FixtureClaimReader([
        { title: 'Libro de obra folio 44', claims: candidates },
      ])),
    );

  it('los fragmentos estructurados pasan tal cual y los de texto se leen con inferencia', async () => {
    const reader = readerOf([candidate({})]);
    const structured = {
      subject: 'losa-n3',
      attribute: 'espesor_cm',
      value: 20,
      unit: 'cm',
      role: 'afirma' as const,
      locator: 'fila',
      confidence: null,
    };
    const chunks = await reader.read(documentOf('libro'), 'folio 44', [
      { locator: 'cuadro', kind: 'fila', claims: [structured] },
      { locator: 'folio 44', kind: 'anotacion', text: 'el shaft se corre a 8,5 m' },
      { locator: 'vacío', kind: 'fila', claims: [] },
    ]);

    expect(chunks[0]).toEqual({
      locator: 'cuadro',
      kind: 'fila',
      text: null,
      claims: [structured],
      rejected: [],
    });
    expect(chunks[1]).toMatchObject({
      locator: 'folio 44',
      kind: 'anotacion',
      text: 'el shaft se corre a 8,5 m',
      claims: [
        {
          subject: 'shaft-s1',
          attribute: 'posicion_m',
          value: 8.5,
          locator: 'folio 44',
          confidence: 0.9,
        },
      ],
      rejected: [],
    });
    expect(chunks[2]?.claims).toEqual([]);
  });

  it('lo rechazado queda registrado con su razón y sin efecto', async () => {
    const reader = readerOf([
      candidate({}),
      candidate({ attribute: 'ancho_cm', unit: 'cm', value: 90, confidence: 0.5 }),
      candidate({ subject: 'torre' }),
    ]);

    const [chunk] = (await reader.read(documentOf('libro'), 'folio 44', [
      { locator: 'folio 44', kind: 'anotacion', text: 'texto' },
    ])) as [ChunkDraft];

    expect(chunk.claims.map((claim) => claim.attribute)).toEqual(['posicion_m']);
    expect(chunk.rejected.map((item) => [item.subject, item.attribute, item.reason])).toEqual([
      ['shaft-s1', 'ancho_cm', 'Confianza 0,50, bajo el mínimo de 0,70'],
      ['torre', 'posicion_m', 'El sujeto o el atributo no está en el proyecto'],
    ]);
  });

  it('un modelo que no responde llega como 503', async () => {
    const reader = new ChunkReader(
      new ExtractClaims({
        read: () => Promise.reject(new InferenceUnavailableError('sin red')),
      }),
    );

    await expect(
      reader.read(documentOf('libro'), 'folio 44', [
        { locator: 'folio 44', kind: 'anotacion', text: 'texto' },
      ]),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'inference_unavailable' },
    });
  });
});
