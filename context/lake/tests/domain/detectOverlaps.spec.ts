import {
  detectOverlaps,
  reassessOverlaps,
} from '../../src/domain/detectOverlaps.ts';
import type { Overlap, OverlapDraft } from '../../src/domain/Overlap.ts';
import type { Proposal } from '../../src/domain/Proposal.ts';
import { footprintModel } from '../footprints.ts';
import { claim, entry, hunk, proposal, revision, at } from '../factories.ts';

const revisions = [
  revision('r-shaft', {
    documentId: 'a201',
    label: 'rev B',
    authorId: 'fernanda',
  }),
  revision('r-colector', {
    documentId: 'is301',
    label: 'rev A',
    authorId: 'javier',
  }),
  revision('r-bandeja', {
    documentId: 'ie301',
    label: 'rev A',
    authorId: 'camila',
  }),
  revision('r-new', {
    documentId: 'a201',
    label: 'rev D',
    authorId: 'fernanda',
  }),
  revision('r-other', {
    documentId: 'is301',
    label: 'rev B',
    authorId: 'javier',
  }),
];

const baseline = [
  entry('shaft-s1', 'posicion_m', 6, { revisionId: 'r-shaft' }),
  entry('shaft-s1', 'ancho_cm', 80, { revisionId: 'r-shaft' }),
  entry('colector-b2', 'posicion_m', 10, { revisionId: 'r-colector' }),
  entry('bandeja-e3', 'posicion_m', 2, { revisionId: 'r-bandeja' }),
  entry('ventanas-norte', 'ancho_cm', 120, { revisionId: 'r-shaft' }),
  entry('losa-n3', 'espesor_cm', 15, { revisionId: 'r-shaft' }),
];

const shaftTo = (meters: number, overrides: Partial<Proposal> = {}): Proposal =>
  proposal('p-shaft', {
    documentId: 'a201',
    sourceRevisionId: 'r-new',
    changes: [hunk('shaft-s1', 'posicion_m', 6, meters, 'm')],
    ...overrides,
  });

const detect = (
  incoming: Proposal[],
  others: Proposal[] = [],
  overrides: { baseline?: typeof baseline } = {},
): OverlapDraft[] =>
  detectOverlaps({
    revision: revisions.find((r) => r.id === incoming[0]?.sourceRevisionId)!,
    revisions,
    claims: [claim('c1', 'r-new', 'shaft-s1', 'posicion_m', 8.5)],
    incoming,
    proposals: [...incoming, ...others],
    baseline: overrides.baseline ?? baseline,
    footprint: footprintModel,
  });

describe('detectOverlaps', () => {
  it('misma área: el shaft nuevo cae sobre el colector vigente', () => {
    const [overlap, ...rest] = detect([shaftTo(8.5)]);
    expect(rest).toEqual([]);
    expect(overlap).toEqual({
      proposalId: 'p-shaft',
      otherProposalId: null,
      revisionId: 'r-new',
      chunkLocator: 'shaft-s1.posicion_m',
      kind: 'misma-area',
      area: { nivel: 'n3', celda: 'C-D/3', sistemas: ['sanitarias'] },
      relation: 'cruce_trazado',
      subjectId: 'shaft-s1',
      otherSubjectId: 'colector-b2',
      otherBacking: { documentId: 'is301', label: 'rev A', ownerId: 'javier' },
      validators: ['fernanda', 'javier'],
    });
  });

  it.each([
    ['otro tramo', 14],
    ['en el límite del tramo siguiente', 12],
    ['fuera de la grilla', 20],
  ])('sin solapamiento: %s', (_name, meters) => {
    expect(detect([shaftTo(meters)])).toEqual([]);
  });

  it('interferencia: sistemas distintos en la misma celda', () => {
    const [overlap] = detect(
      [
        proposal('p-bandeja', {
          documentId: 'ie301',
          authorId: 'camila',
          sourceRevisionId: 'r-bandeja',
          changes: [hunk('bandeja-e3', 'posicion_m', 2, 9, 'm')],
        }),
      ],
      [],
    );
    expect(overlap).toMatchObject({
      kind: 'misma-area',
      subjectId: 'bandeja-e3',
      otherSubjectId: 'colector-b2',
      relation: 'interferencia',
      area: {
        nivel: 'n3',
        celda: 'C-D/3',
        sistemas: ['electricas', 'sanitarias'],
      },
      validators: ['camila', 'javier'],
    });
  });

  it('un cruce con el shaft comparte sistema y por eso es cruce de trazado', () => {
    const [overlap] = detect([
      proposal('p-bandeja', {
        sourceRevisionId: 'r-bandeja',
        authorId: 'camila',
        changes: [hunk('bandeja-e3', 'posicion_m', 2, 6, 'm')],
      }),
    ]);
    expect(overlap).toMatchObject({
      otherSubjectId: 'shaft-s1',
      relation: 'cruce_trazado',
      area: { celda: 'B-C/3', sistemas: ['electricas'] },
    });
  });

  it('simultáneo: dos PR abiertos terminan en el mismo lugar', () => {
    const colectorMoves = proposal('p-colector', {
      documentId: 'is301',
      authorId: 'javier',
      sourceRevisionId: 'r-other',
      openedAt: at(2),
      changes: [hunk('colector-b2', 'posicion_m', 10, 13.5, 'm')],
    });
    const [overlap] = detect([shaftTo(14)], [colectorMoves]);
    expect(overlap).toMatchObject({
      kind: 'simultaneo',
      proposalId: 'p-shaft',
      otherProposalId: 'p-colector',
      otherSubjectId: 'colector-b2',
      area: { nivel: 'n3', celda: 'D-E/3' },
      otherBacking: { label: 'rev B', ownerId: 'javier' },
    });
  });

  it('el estado final de una propuesta abierta cuenta aunque lo vigente no se toque', () => {
    const colectorMoves = proposal('p-colector', {
      documentId: 'is301',
      authorId: 'javier',
      sourceRevisionId: 'r-other',
      changes: [hunk('colector-b2', 'posicion_m', 10, 13.5, 'm')],
    });
    expect(detect([shaftTo(8.5)], [colectorMoves])).toEqual([]);
  });

  it('un soporte no genera solapamientos de área', () => {
    expect(
      detect([
        proposal('p-losa', {
          changes: [hunk('losa-n3', 'espesor_cm', 15, 20, 'cm')],
        }),
      ]),
    ).toEqual([]);
  });

  it('un cambio que no mueve la huella no abre solapamiento aunque ya se toquen', () => {
    const touching = baseline.map((item) =>
      item.subject === 'shaft-s1' && item.attribute === 'posicion_m'
        ? { ...item, value: 8.5 }
        : item,
    );
    expect(
      detect(
        [
          proposal('p-shaft', {
            documentId: 'a201',
            sourceRevisionId: 'r-new',
            changes: [hunk('shaft-s1', 'ancho_cm', 80, 90, 'cm')],
          }),
        ],
        [],
        { baseline: touching },
      ),
    ).toEqual([]);
  });

  it('mismo elemento: otro dato del mismo elemento está en un PR abierto de otro documento', () => {
    const other = proposal('p-ancho', {
      documentId: 'e102',
      authorId: 'paula',
      sourceRevisionId: 'r-other',
      changes: [hunk('shaft-s1', 'ancho_cm', 80, 90, 'cm')],
    });
    const overlaps = detect([shaftTo(14)], [other]);
    expect(overlaps).toEqual([
      expect.objectContaining({
        kind: 'mismo-elemento',
        proposalId: 'p-shaft',
        otherProposalId: 'p-ancho',
        subjectId: 'shaft-s1',
        otherSubjectId: 'shaft-s1',
        area: null,
        relation: null,
        validators: ['fernanda', 'javier'],
      }),
    ]);
  });

  it('mismo elemento no aplica si los dos PR cambian el mismo atributo', () => {
    const other = proposal('p-pos', {
      documentId: 'e102',
      sourceRevisionId: 'r-other',
      changes: [hunk('shaft-s1', 'posicion_m', 6, 7, 'm')],
    });
    expect(
      detect([shaftTo(14)], [other]).filter((o) => o.kind === 'mismo-elemento'),
    ).toEqual([]);
  });

  it('un validador no se repite cuando el autor es dueño de los dos lados', () => {
    const [overlap] = detect([shaftTo(8.5, { authorId: 'javier' })], [], {
      baseline: baseline.map((item) =>
        item.subject === 'colector-b2'
          ? { ...item, revisionId: 'r-new' }
          : item,
      ),
    });
    expect(overlap?.validators).toEqual(['fernanda']);
  });

  it('el localizador es el del hunk que movió la huella', () => {
    const [overlap] = detect([
      proposal('p-shaft', {
        documentId: 'a201',
        sourceRevisionId: 'r-new',
        changes: [
          { ...hunk('shaft-s1', 'ancho_cm', 80, 90, 'cm'), locator: 'detalle' },
          { ...hunk('shaft-s1', 'posicion_m', 6, 8.5, 'm'), locator: 'cota' },
        ],
      }),
    ]);
    expect(overlap?.chunkLocator).toBe('cota');
  });

  it('un PR cerrado no cuenta como activo', () => {
    expect(detect([shaftTo(8.5, { status: 'withdrawn' })])).toEqual([]);
  });

  it('no repite el par cuando los dos PR llegan en la misma revisión', () => {
    const a = shaftTo(8.5);
    const b = proposal('p-colector', {
      documentId: 'a201',
      sourceRevisionId: 'r-new',
      authorId: 'fernanda',
      changes: [hunk('colector-b2', 'posicion_m', 10, 9, 'm')],
    });
    expect(detect([a, b]).length).toBe(1);
  });
});

const live = (overrides: Partial<Overlap>): Overlap => ({
  id: 'o1',
  proposalId: 'p-shaft',
  otherProposalId: null,
  revisionId: 'r-new',
  chunkLocator: 'cota',
  kind: 'misma-area',
  area: { nivel: 'n3', celda: 'C-D/3', sistemas: ['sanitarias'] },
  relation: 'cruce_trazado',
  subjectId: 'shaft-s1',
  otherSubjectId: 'colector-b2',
  otherBacking: { documentId: 'is301', label: 'rev A', ownerId: 'javier' },
  validators: ['fernanda', 'javier'],
  status: 'abierto',
  votes: [],
  resolution: null,
  createdAt: at(1),
  resolvedAt: null,
  ...overrides,
});

describe('reassessOverlaps', () => {
  const reassess = (
    overlaps: Overlap[],
    proposals: Proposal[],
    values: typeof baseline = baseline,
  ) =>
    reassessOverlaps(overlaps, {
      baseline: values,
      proposals,
      footprint: footprintModel,
    });

  it.each<[string, Proposal[], typeof baseline | undefined, string | null]>([
    ['sigue igual', [shaftTo(8.5)], undefined, null],
    [
      'el colector se mueve en lo vigente',
      [shaftTo(8.5)],
      baseline.map((item) =>
        item.subject === 'colector-b2' ? { ...item, value: 13.5 } : item,
      ),
      'sin_area_comun',
    ],
    [
      'el colector solo se mueve en un PR abierto: lo vigente sigue igual',
      [
        shaftTo(8.5),
        proposal('p-colector', {
          changes: [hunk('colector-b2', 'posicion_m', 10, 13.5, 'm')],
        }),
      ],
      undefined,
      null,
    ],
    [
      'el shaft vuelve a otro tramo en una revisión nueva',
      [shaftTo(14)],
      undefined,
      'sin_area_comun',
    ],
    [
      'se retira el PR',
      [shaftTo(8.5, { status: 'withdrawn' })],
      undefined,
      'retirada',
    ],
    [
      'se reemplaza el PR',
      [shaftTo(8.5, { status: 'superseded' })],
      undefined,
      'reemplazada',
    ],
    [
      'el PR ya entró: no se toca',
      [shaftTo(8.5, { status: 'merged' })],
      undefined,
      null,
    ],
  ])('%s', (_name, proposals, values, expected) => {
    const result = reassess([live({})], proposals, values);
    expect(result.map((item) => item.resolution)).toEqual(
      expected ? [expected] : [],
    );
  });

  it.each(['descartado', 'resuelto'] as const)(
    'no reevalúa un solapamiento %s',
    (status) => {
      expect(reassess([live({ status })], [shaftTo(14)])).toEqual([]);
    },
  );

  it('simultáneo: se resuelve cuando el estado final de los dos PR ya no se cruza', () => {
    const overlap = live({
      kind: 'simultaneo',
      otherProposalId: 'p-colector',
      area: { nivel: 'n3', celda: 'D-E/3', sistemas: ['sanitarias'] },
    });
    const colector = proposal('p-colector', {
      changes: [hunk('colector-b2', 'posicion_m', 10, 13.5, 'm')],
    });
    expect(reassess([overlap], [shaftTo(14), colector])).toEqual([]);
    expect(
      reassess(
        [overlap],
        [shaftTo(14), { ...colector, status: 'withdrawn' }],
      ).map((item) => item.resolution),
    ).toEqual(['sin_area_comun']);
  });

  it('un solapamiento confirmado también se resuelve al separarse', () => {
    expect(
      reassess([live({ status: 'confirmado' })], [shaftTo(14)]).map(
        (item) => item.overlapId,
      ),
    ).toEqual(['o1']);
  });

  it('mismo elemento: se resuelve cuando el otro PR se cierra', () => {
    const overlap = live({
      kind: 'mismo-elemento',
      otherProposalId: 'p-ancho',
      area: null,
      relation: null,
      otherSubjectId: 'shaft-s1',
    });
    const other = proposal('p-ancho', {
      changes: [hunk('shaft-s1', 'ancho_cm', 80, 90)],
    });
    expect(reassess([overlap], [shaftTo(14), other])).toEqual([]);
    expect(
      reassess([overlap], [shaftTo(14), { ...other, status: 'merged' }]),
    ).toEqual([{ overlapId: 'o1', resolution: 'otra_propuesta_cerrada' }]);
  });
});
