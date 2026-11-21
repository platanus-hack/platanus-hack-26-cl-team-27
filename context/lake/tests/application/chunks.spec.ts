import { ValidationError } from '../../src/application/errors.ts';
import { persistChunks } from '../../src/application/persistChunks.ts';
import type { ChunkDraft } from '../../src/domain/Chunk.ts';
import { consensusIndex } from '../../src/domain/consensusIndex.ts';
import { overlapOf, revision } from '../factories.ts';
import { afirma, buildLake, draftOf } from '../scenario.ts';

const row = (
  locator: string,
  ...claims: ReturnType<typeof afirma>[]
): ChunkDraft => ({
  locator,
  kind: 'fila',
  text: null,
  claims,
  rejected: [],
});

describe('fragmentos', () => {
  it('guarda los fragmentos en orden y cada hecho hereda el localizador de su fragmento', async () => {
    const { lake } = buildLake();
    const saved = await persistChunks(lake.chunks, lake.claims, 'rev-1', [
      row(
        'cuadro de losas · Losa nivel 3',
        afirma('losa-n3', 'espesor_cm', 20),
      ),
      {
        locator: 'folio 44',
        kind: 'anotacion',
        text: 'el shaft se corre a 8,5 m',
        claims: [{ ...afirma('shaft-s1', 'posicion_m', 8.5), confidence: 0.9 }],
        rejected: [
          {
            subject: 'shaft-s1',
            attribute: 'ancho_cm',
            value: 90,
            unit: 'cm',
            role: 'afirma',
            confidence: 0.5,
            reason: 'Confianza 0,50, bajo el mínimo de 0,70',
          },
        ],
      },
    ]);

    expect(
      saved.chunks.map((chunk) => [chunk.position, chunk.locator, chunk.kind]),
    ).toEqual([
      [0, 'cuadro de losas · Losa nivel 3', 'fila'],
      [1, 'folio 44', 'anotacion'],
    ]);
    expect(saved.chunks[1]).toMatchObject({
      text: 'el shaft se corre a 8,5 m',
      rejected: [{ attribute: 'ancho_cm', confidence: 0.5 }],
    });
    expect(
      saved.claims.map((claim) => [
        claim.locator,
        claim.chunkId,
        claim.confidence,
      ]),
    ).toEqual([
      ['cuadro de losas · Losa nivel 3', saved.chunks[0]?.id, null],
      ['folio 44', saved.chunks[1]?.id, 0.9],
    ]);
  });

  it('un hecho sin confianza queda con confianza nula y uno con confianza la conserva', async () => {
    const { lake } = buildLake();
    const { claims } = await persistChunks(lake.chunks, lake.claims, 'rev-1', [
      row('a', afirma('s', 'espesor_cm', 1), {
        ...afirma('s', 'ancho_cm', 2),
        confidence: 0.95,
      }),
    ]);
    expect(claims.map((claim) => claim.confidence)).toEqual([null, 0.95]);
  });

  it('el ingreso guarda los fragmentos de la revisión', async () => {
    const ctx = buildLake({
      'e102@rev C': [afirma('losa-n3', 'espesor_cm', 20)],
    });
    const result = await ctx.ingest.execute(draftOf('e102', 'rev C', 'plano'));
    expect(result.chunks).toHaveLength(1);
    expect(result.claims[0]?.chunkId).toBe(result.chunks[0]?.id);
    expect(await ctx.lake.chunks.list()).toHaveLength(1);
  });

  it.each([
    ['sin localizador', { ...row(' ', afirma('s', 'espesor_cm', 1)) }],
    [
      'con un tipo desconocido',
      { ...row('a', afirma('s', 'espesor_cm', 1)), kind: 'otro' as never },
    ],
  ])('rechaza un fragmento %s', async (_name, chunk) => {
    const ctx = buildLake();
    ctx.lake.extractor.extract.mockResolvedValueOnce([chunk]);
    await expect(
      ctx.ingest.execute(draftOf('x', '1', 'plano')),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rechaza el mismo hecho repetido en fragmentos distintos', async () => {
    const ctx = buildLake();
    ctx.lake.extractor.extract.mockResolvedValueOnce([
      row('a', afirma('s', 'espesor_cm', 1)),
      row('b', afirma('s', 'espesor_cm', 2)),
    ]);
    await expect(
      ctx.ingest.execute(draftOf('x', '1', 'plano')),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('la carga inicial borra y vuelve a guardar los fragmentos', async () => {
    const ctx = buildLake();
    const input = {
      revisions: [
        {
          revision: draftOf('e102', 'rev B', 'plano'),
          chunks: [row('a', afirma('losa-n3', 'espesor_cm', 15))],
        },
      ],
    };
    await ctx.seed.execute(input);
    await ctx.seed.execute(input);
    expect(await ctx.lake.chunks.list()).toHaveLength(1);
    expect(await ctx.lake.overlaps.list()).toEqual([]);
  });
});

describe('PR por revisión', () => {
  const seeded = async () => {
    const ctx = buildLake({
      'a201@rev C': [
        afirma('ventanas-norte', 'ancho_cm', 150),
        afirma('shaft-s1', 'posicion_m', 7),
      ],
      'a201@rev D': [
        afirma('ventanas-norte', 'ancho_cm', 150),
        afirma('shaft-s1', 'posicion_m', 8),
      ],
    });
    await ctx.seed.execute({
      revisions: [
        {
          revision: draftOf('a201', 'rev B', 'plano'),
          chunks: [
            row(
              'cuadro',
              afirma('ventanas-norte', 'ancho_cm', 120),
              afirma('shaft-s1', 'posicion_m', 6),
            ),
          ],
        },
      ],
    });
    return ctx;
  };

  it('una revisión que cambia dos elementos abre un solo PR con dos hunks', async () => {
    const ctx = await seeded();
    const ingested = await ctx.ingest.execute(
      draftOf('a201', 'rev C', 'plano'),
    );
    expect(
      ingested.draft?.changes.map((c) => `${c.subject}.${c.attribute}`),
    ).toEqual(['ventanas-norte.ancho_cm', 'shaft-s1.posicion_m']);
    const { proposal } = await ctx.open.execute({
      draft: ingested.draft!,
      changeId: null,
      reviewerIds: ['paula'],
      filtered: [],
    });
    expect(proposal.changes).toHaveLength(2);
    expect(await ctx.lake.proposals.list()).toHaveLength(1);

    await ctx.review.execute({
      proposalId: proposal.id,
      reviewerId: 'paula',
      decision: 'approve',
    });
    const baseline = await ctx.lake.baseline.list();
    expect(
      baseline
        .filter((entry) => entry.proposalId === proposal.id)
        .map((entry) => [entry.subject, entry.value, entry.version])
        .sort(),
    ).toEqual([
      ['shaft-s1', 7, 2],
      ['ventanas-norte', 150, 2],
    ]);
  });

  it('una revisión nueva del mismo documento reemplaza el PR abierto y lo conserva completo', async () => {
    const ctx = await seeded();
    const first = await ctx.ingest.execute(draftOf('a201', 'rev C', 'plano'));
    const opened = await ctx.open.execute({
      draft: first.draft!,
      changeId: null,
      reviewerIds: ['paula', 'javier'],
      filtered: [],
    });
    await ctx.review.execute({
      proposalId: opened.proposal.id,
      reviewerId: 'paula',
      decision: 'approve',
    });

    const second = await ctx.ingest.execute(draftOf('a201', 'rev D', 'plano'));
    expect(
      second.draft?.changes.map((c) => `${c.subject}:${String(c.after)}`),
    ).toEqual(['ventanas-norte:150', 'shaft-s1:8']);
    const next = await ctx.open.execute({
      draft: second.draft!,
      changeId: null,
      reviewerIds: ['paula', 'javier'],
      filtered: [],
    });

    expect(next.superseded.map((p) => p.id)).toEqual([opened.proposal.id]);
    expect(
      next.proposal.reviews.every((review) => review.decision === null),
    ).toBe(true);
    expect(
      (await ctx.lake.proposals.findById(opened.proposal.id))?.status,
    ).toBe('superseded');
  });

  it('un PR sin revisores se fusiona al abrir, salvo que se pida esperar', async () => {
    const ctx = await seeded();
    const first = await ctx.ingest.execute(draftOf('a201', 'rev C', 'plano'));
    const waiting = await ctx.open.execute({
      draft: first.draft!,
      changeId: null,
      reviewerIds: [],
      filtered: [],
      deferMerge: true,
    });
    expect(waiting.proposal.status).toBe('open');
    expect((await ctx.settle.execute()).merged.map((p) => p.id)).toEqual([
      waiting.proposal.id,
    ]);

    const second = await ctx.ingest.execute(draftOf('a201', 'rev D', 'plano'));
    const direct = await ctx.open.execute({
      draft: second.draft!,
      changeId: null,
      reviewerIds: [],
      filtered: [],
    });
    expect(direct.proposal.status).toBe('merged');
  });

  it('guarda los cambios de capture y el cambio principal de la propuesta', async () => {
    const ctx = await seeded();
    const ingested = await ctx.ingest.execute(
      draftOf('a201', 'rev C', 'plano'),
    );
    const { proposal } = await ctx.open.execute({
      draft: ingested.draft!,
      changeId: 'c1',
      changeIds: ['c1', 'c2'],
      reviewerIds: ['paula'],
      filtered: [],
    });
    expect(proposal).toMatchObject({
      changeId: 'c1',
      changeIds: ['c1', 'c2'],
      documentId: 'a201',
    });
  });
});

describe('índice de consenso con solapamientos', () => {
  it.each([
    ['abierto', 1, false],
    ['confirmado', 1, false],
    ['descartado', 0, true],
    ['resuelto', 0, true],
  ] as const)(
    'un solapamiento %s cuenta %i y el sello es %s',
    (status, open, sealed) => {
      const index = consensusIndex({
        revisions: [revision('r1')],
        stale: [],
        discrepancies: [],
        proposals: [],
        overlaps: [overlapOf('o1', { status })],
      });
      expect(index).toMatchObject({ openOverlaps: open, sealed });
    },
  );
});
