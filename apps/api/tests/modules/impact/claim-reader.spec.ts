import {
  ExtractClaims,
  InferenceUnavailableError,
  type ClaimCandidate,
} from '@team27/context-impact';
import { FixtureClaimReader } from '@team27/context-impact/adapters';
import type { ChunkDraft } from '@team27/context-lake';

import { ChunkReader } from '../../../src/modules/coordination/chunk-reader.ts';
import { project } from '../../project.ts';
import { chooseClaimReader } from '../../../src/modules/impact/claim-reader.ts';
import { buildVocabulary } from '../../../src/modules/impact/vocabulary.ts';

const query = {
  evidence: {
    kind: 'text' as const,
    source: 'libro_obra' as const,
    title: 'Libro de obra folio 44',
    text: 'El shaft S1 se corre a 8,5 m del eje A.',
  },
  vocabulary: buildVocabulary(project),
};

describe('elección del lector de afirmaciones', () => {
  it.each([
    ['sin clave', undefined],
    ['con la clave vacía', ''],
    ['con la clave en blanco', '   '],
  ])('%s, no lee texto libre y dice que falta la clave', async (_name, key) => {
    const choice = chooseClaimReader(key);
    expect(choice.mode).toBe('unavailable');
    await expect(choice.reader.read(query)).rejects.toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });

  it('con una clave real usa a Claude', () => {
    expect(chooseClaimReader('sk-ant-prueba').mode).toBe('claude');
  });

  it('sin clave de Claude y con una de Gemini usa a Gemini', () => {
    expect(chooseClaimReader(undefined, { apiKey: 'AIza-prueba' }).mode).toBe(
      'gemini',
    );
  });

  it('con las dos claves prefiere a Claude', () => {
    expect(
      chooseClaimReader('sk-ant-prueba', { apiKey: 'AIza-prueba' }).mode,
    ).toBe('claude');
  });

  it('sin clave, un fragmento de texto llega como 503', async () => {
    const reader = new ChunkReader(
      new ExtractClaims(chooseClaimReader(undefined).reader),
    );
    await expect(
      reader.read(project, project.documentOf('libro'), 'folio 44', [
        { locator: 'folio 44', kind: 'anotacion', text: 'texto' },
      ]),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'inference_unavailable' },
    });
  });
});

describe('vocabulario del proyecto', () => {
  it('nombra a los sujetos con sus atributos y unidades', () => {
    const vocabulary = buildVocabulary(project);
    expect(
      vocabulary.subjects
        .find((subject) => subject.id === 'colector-b2')
        ?.attributes.map((attribute) => [attribute.key, attribute.unit]),
    ).toEqual([['posicion_m', 'm']]);
    expect(vocabulary.stakeholders).toHaveLength(project.cast.length);
  });
});

describe('ChunkReader', () => {
  const candidate = (overrides: Partial<ClaimCandidate>): ClaimCandidate => ({
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
      new ExtractClaims(
        new FixtureClaimReader([
          { title: 'Libro de obra folio 44', claims: candidates },
        ]),
      ),
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
    const chunks = await reader.read(
      project,
      project.documentOf('libro'),
      'folio 44',
      [
        { locator: 'cuadro', kind: 'fila', claims: [structured] },
        {
          locator: 'folio 44',
          kind: 'anotacion',
          text: 'el shaft se corre a 8,5 m',
        },
        { locator: 'vacío', kind: 'fila', claims: [] },
      ],
    );

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
      candidate({
        attribute: 'ancho_cm',
        unit: 'cm',
        value: 90,
        confidence: 0.5,
      }),
      candidate({ subject: 'torre' }),
    ]);

    const [chunk] = (await reader.read(
      project,
      project.documentOf('libro'),
      'folio 44',
      [{ locator: 'folio 44', kind: 'anotacion', text: 'texto' }],
    )) as [ChunkDraft];

    expect(chunk.claims.map((claim) => claim.attribute)).toEqual([
      'posicion_m',
    ]);
    expect(
      chunk.rejected.map((item) => [item.subject, item.attribute, item.reason]),
    ).toEqual([
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
      reader.read(project, project.documentOf('libro'), 'folio 44', [
        { locator: 'folio 44', kind: 'anotacion', text: 'texto' },
      ]),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'inference_unavailable' },
    });
  });
});
