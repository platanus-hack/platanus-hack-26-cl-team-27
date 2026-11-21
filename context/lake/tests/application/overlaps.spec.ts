import { ValidationError } from '../../src/application/errors.ts';
import { chunksFromClaims } from '../../src/domain/Chunk.ts';
import { afirma, buildLake, draftOf } from '../scenario.ts';

type Ctx = ReturnType<typeof buildLake>;

const withUnit = (
  subject: string,
  attribute: string,
  value: number,
  locator: string,
) => ({
  ...afirma(subject, attribute, value),
  unit: 'm',
  locator,
});

const catalog = {
  'a201@rev D': [withUnit('shaft-s1', 'posicion_m', 8.5, 'cota shaft')],
  'a201@rev E': [withUnit('shaft-s1', 'posicion_m', 8.6, 'cota shaft')],
  'a201@rev F': [withUnit('shaft-s1', 'posicion_m', 14, 'cota shaft')],
  'is301@rev B': [withUnit('colector-b2', 'posicion_m', 13.5, 'cuadro')],
};

const setup = async () => {
  const ctx = buildLake(catalog);
  await ctx.seed.execute({
    revisions: [
      {
        revision: draftOf('a201', 'rev B', 'plano'),
        chunks: chunksFromClaims([
          withUnit('shaft-s1', 'posicion_m', 6, 'cota'),
        ]),
      },
      {
        revision: draftOf('is301', 'rev A', 'plano', 'javier'),
        chunks: chunksFromClaims([
          withUnit('colector-b2', 'posicion_m', 10, 'cuadro'),
        ]),
      },
    ],
  });
  return ctx;
};

const submit = async (
  ctx: Ctx,
  documentId: string,
  label: string,
  authorId: string,
  reviewerIds: string[],
) => {
  const ingested = await ctx.ingest.execute(
    draftOf(documentId, label, 'plano', authorId),
  );
  let proposalId: string | null = null;
  if (ingested.draft) {
    const { proposal } = await ctx.open.execute({
      draft: ingested.draft,
      changeId: null,
      reviewerIds,
      filtered: [],
      deferMerge: true,
    });
    proposalId = proposal.id;
  }
  await ctx.resolve.execute();
  const opened = await ctx.openOverlaps.execute({
    revisionId: ingested.revision.id,
    proposalIds: proposalId ? [proposalId] : [],
  });
  const settled = await ctx.settle.execute();
  return { ingested, proposalId, opened, settled };
};

const shaftProposal = async (
  ctx: Ctx,
  reviewers = ['paula', 'javier', 'camila'],
) => submit(ctx, 'a201', 'rev D', 'fernanda', reviewers);

const approveAll = async (ctx: Ctx, proposalId: string, ids: string[]) => {
  let last;
  for (const reviewerId of ids) {
    last = await ctx.review.execute({
      proposalId,
      reviewerId,
      decision: 'approve',
    });
  }
  return last;
};

const baselineOf = async (ctx: Ctx, subject: string, attribute: string) =>
  (await ctx.lake.baseline.find(subject, attribute))?.value;

describe('apertura de solapamientos al ingresar', () => {
  it('abre el PR del shaft y un solapamiento de misma área con el colector', async () => {
    const ctx = await setup();
    const { opened, proposalId } = await shaftProposal(ctx);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({
      kind: 'misma-area',
      status: 'abierto',
      proposalId,
      subjectId: 'shaft-s1',
      otherSubjectId: 'colector-b2',
      area: { nivel: 'n3', celda: 'C-D/3', sistemas: ['sanitarias'] },
      chunkLocator: 'cota shaft',
      validators: ['fernanda', 'javier'],
      otherBacking: { documentId: 'is301', label: 'rev A', ownerId: 'javier' },
    });
  });

  it('no abre nada si la huella queda lejos', async () => {
    const ctx = await setup();
    const { opened } = await submit(ctx, 'a201', 'rev F', 'fernanda', [
      'paula',
    ]);
    expect(opened).toEqual([]);
  });

  it('no repite el solapamiento al detectar de nuevo', async () => {
    const ctx = await setup();
    const { ingested, proposalId } = await shaftProposal(ctx);
    const again = await ctx.openOverlaps.execute({
      revisionId: ingested.revision.id,
      proposalIds: [proposalId as string],
    });
    expect(again).toEqual([]);
    expect(await ctx.lake.overlaps.list()).toHaveLength(1);
  });

  it('rechaza detectar sobre una revisión que no existe', async () => {
    const ctx = await setup();
    await expect(
      ctx.openOverlaps.execute({ revisionId: 'nada', proposalIds: ['p'] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('validación conjunta', () => {
  it('si alguno dice que se tocan, queda confirmado con su nota', async () => {
    const ctx = await setup();
    const { opened } = await shaftProposal(ctx);
    const voted = await ctx.voteOverlap.execute({
      overlapId: opened[0]!.id,
      validatorId: 'javier',
      kind: 'se_tocan',
      note: ' El shaft cruza el colector ',
    });
    expect(voted).toMatchObject({
      changed: true,
      from: 'abierto',
      overlap: { status: 'confirmado' },
    });
    expect(voted.overlap.votes).toEqual([
      expect.objectContaining({
        validatorId: 'javier',
        kind: 'se_tocan',
        note: 'El shaft cruza el colector',
      }),
    ]);
  });

  it('un solo no_se_tocan no alcanza: faltan los demás validadores', async () => {
    const ctx = await setup();
    const { opened } = await shaftProposal(ctx);
    const voted = await ctx.voteOverlap.execute({
      overlapId: opened[0]!.id,
      validatorId: 'fernanda',
      kind: 'no_se_tocan',
    });
    expect(voted.overlap.status).toBe('abierto');
  });

  it('si todos dicen que no se tocan, queda descartado', async () => {
    const ctx = await setup();
    const { opened } = await shaftProposal(ctx);
    for (const validatorId of ['fernanda', 'javier']) {
      await ctx.voteOverlap.execute({
        overlapId: opened[0]!.id,
        validatorId,
        kind: 'no_se_tocan',
      });
    }
    expect((await ctx.lake.overlaps.findById(opened[0]!.id))?.status).toBe(
      'descartado',
    );
  });

  it('confirmado sigue confirmado aunque el otro diga que no se tocan', async () => {
    const ctx = await setup();
    const { opened } = await shaftProposal(ctx);
    await ctx.voteOverlap.execute({
      overlapId: opened[0]!.id,
      validatorId: 'javier',
      kind: 'se_tocan',
    });
    const second = await ctx.voteOverlap.execute({
      overlapId: opened[0]!.id,
      validatorId: 'fernanda',
      kind: 'no_se_tocan',
    });
    expect(second.overlap.status).toBe('confirmado');
    expect(second.overlap.votes).toHaveLength(2);
  });

  it.each([
    [
      'quien no valida',
      { validatorId: 'paula', kind: 'se_tocan' as const },
      'Quien vota no valida este solapamiento',
    ],
    [
      'un solapamiento que no existe',
      { overlapId: 'nada', validatorId: 'javier', kind: 'se_tocan' as const },
      'El solapamiento no existe',
    ],
  ])('rechaza el voto de %s', async (_name, input, message) => {
    const ctx = await setup();
    const { opened } = await shaftProposal(ctx);
    await expect(
      ctx.voteOverlap.execute({ overlapId: opened[0]!.id, ...input }),
    ).rejects.toThrow(message);
  });

  it('repetir el mismo voto no cambia nada y cambiarlo es un error', async () => {
    const ctx = await setup();
    const { opened } = await shaftProposal(ctx);
    const input = {
      overlapId: opened[0]!.id,
      validatorId: 'javier',
      kind: 'se_tocan' as const,
    };
    await ctx.voteOverlap.execute(input);
    expect(await ctx.voteOverlap.execute(input)).toMatchObject({
      changed: false,
    });
    await expect(
      ctx.voteOverlap.execute({ ...input, kind: 'no_se_tocan' }),
    ).rejects.toThrow('ya respondió');
  });

  it('un solapamiento descartado o resuelto ya no admite votos', async () => {
    const ctx = await setup();
    const { opened } = await shaftProposal(ctx);
    for (const validatorId of ['fernanda', 'javier']) {
      await ctx.voteOverlap.execute({
        overlapId: opened[0]!.id,
        validatorId,
        kind: 'no_se_tocan',
      });
    }
    const other = await ctx.lake.overlaps.create({
      ...opened[0]!,
      subjectId: 'x',
      otherSubjectId: 'y',
    });
    await ctx.lake.overlaps.save({ ...other, status: 'resuelto' });
    await expect(
      ctx.voteOverlap.execute({
        overlapId: other.id,
        validatorId: 'javier',
        kind: 'se_tocan',
      }),
    ).rejects.toThrow('ya no admite votos');
  });
});

describe('la propuesta no entra mientras haya solapamientos', () => {
  it('con todas las aprobaciones no se fusiona mientras el solapamiento esté abierto', async () => {
    const ctx = await setup();
    const { proposalId } = await shaftProposal(ctx);
    const last = await approveAll(ctx, proposalId!, [
      'paula',
      'javier',
      'camila',
    ]);
    expect(last).toMatchObject({
      merged: false,
      proposal: { status: 'open' },
    });
    expect(await baselineOf(ctx, 'shaft-s1', 'posicion_m')).toBe(6);
  });

  it('confirmado tampoco deja pasar', async () => {
    const ctx = await setup();
    const { proposalId, opened } = await shaftProposal(ctx);
    await ctx.voteOverlap.execute({
      overlapId: opened[0]!.id,
      validatorId: 'javier',
      kind: 'se_tocan',
    });
    await approveAll(ctx, proposalId!, ['paula', 'javier', 'camila']);
    expect((await ctx.settle.execute()).merged).toEqual([]);
    expect(await baselineOf(ctx, 'shaft-s1', 'posicion_m')).toBe(6);
  });

  it('al descartarse el solapamiento, el PR con todas las aprobaciones entra', async () => {
    const ctx = await setup();
    const { proposalId, opened } = await shaftProposal(ctx);
    await approveAll(ctx, proposalId!, ['paula', 'javier', 'camila']);
    for (const validatorId of ['fernanda', 'javier']) {
      await ctx.voteOverlap.execute({
        overlapId: opened[0]!.id,
        validatorId,
        kind: 'no_se_tocan',
      });
    }
    const settled = await ctx.settle.execute();
    expect(settled.merged.map((p) => p.id)).toEqual([proposalId]);
    expect(await baselineOf(ctx, 'shaft-s1', 'posicion_m')).toBe(8.5);
  });

  it('al descartarse sin todas las aprobaciones, el PR sigue abierto', async () => {
    const ctx = await setup();
    const { proposalId, opened } = await shaftProposal(ctx);
    await approveAll(ctx, proposalId!, ['paula']);
    for (const validatorId of ['fernanda', 'javier']) {
      await ctx.voteOverlap.execute({
        overlapId: opened[0]!.id,
        validatorId,
        kind: 'no_se_tocan',
      });
    }
    expect((await ctx.settle.execute()).merged).toEqual([]);
    expect((await ctx.lake.proposals.findById(proposalId!))?.status).toBe(
      'open',
    );
  });

  it('el PR sin revisores queda en espera mientras haya solapamiento y entra al resolverse', async () => {
    const ctx = await setup();
    const { proposalId } = await submit(ctx, 'a201', 'rev D', 'fernanda', []);
    expect((await ctx.lake.proposals.findById(proposalId!))?.status).toBe(
      'open',
    );
    const { settled } = await submit(ctx, 'is301', 'rev B', 'javier', []);
    expect(settled.merged.map((p) => p.documentId).sort()).toEqual([
      'a201',
      'is301',
    ]);
    expect(await baselineOf(ctx, 'colector-b2', 'posicion_m')).toBe(13.5);
    expect(await baselineOf(ctx, 'shaft-s1', 'posicion_m')).toBe(8.5);
  });
});

describe('resolución por nueva detección', () => {
  it('una revisión que mueve el colector resuelve el solapamiento y deja entrar al shaft', async () => {
    const ctx = await setup();
    const { proposalId, opened } = await shaftProposal(ctx);
    await ctx.voteOverlap.execute({
      overlapId: opened[0]!.id,
      validatorId: 'javier',
      kind: 'se_tocan',
    });
    await approveAll(ctx, proposalId!, ['paula', 'javier', 'camila']);
    expect(await baselineOf(ctx, 'shaft-s1', 'posicion_m')).toBe(6);

    const { settled } = await submit(ctx, 'is301', 'rev B', 'javier', []);

    expect(settled.resolved.map((o) => o.id)).toEqual([opened[0]!.id]);
    expect(settled.resolved[0]).toMatchObject({
      status: 'resuelto',
      resolution: 'sin_area_comun',
    });
    expect(settled.merged.map((p) => p.documentId).sort()).toEqual([
      'a201',
      'is301',
    ]);
    expect(await baselineOf(ctx, 'colector-b2', 'posicion_m')).toBe(13.5);
    expect(await baselineOf(ctx, 'shaft-s1', 'posicion_m')).toBe(8.5);
    expect((await ctx.consensus.execute()).index.openOverlaps).toBe(0);
  });

  it('al resolverse, el PR que aún espera aprobaciones sigue abierto', async () => {
    const ctx = await setup();
    const { proposalId } = await shaftProposal(ctx);
    await approveAll(ctx, proposalId!, ['paula']);
    await submit(ctx, 'is301', 'rev B', 'javier', []);
    expect((await ctx.lake.proposals.findById(proposalId!))?.status).toBe(
      'open',
    );
    const last = await approveAll(ctx, proposalId!, ['javier', 'camila']);
    expect(last).toMatchObject({ merged: true });
  });

  it('retirar el PR resuelve el solapamiento', async () => {
    const ctx = await setup();
    const { proposalId, opened } = await shaftProposal(ctx);
    await ctx.withdraw.execute({
      proposalId: proposalId!,
      actorId: 'fernanda',
    });
    const resolved = await ctx.resolve.execute();
    expect(resolved).toEqual([
      expect.objectContaining({
        id: opened[0]!.id,
        status: 'resuelto',
        resolution: 'retirada',
      }),
    ]);
  });

  it('una revisión nueva del mismo documento reemplaza el PR y su solapamiento, y detecta de nuevo', async () => {
    const ctx = await setup();
    const first = await shaftProposal(ctx);
    const second = await submit(ctx, 'a201', 'rev E', 'fernanda', ['paula']);
    expect((await ctx.lake.proposals.findById(first.proposalId!))?.status).toBe(
      'superseded',
    );
    const all = await ctx.listOverlaps.execute();
    expect(all.map((o) => [o.id === first.opened[0]!.id, o.status])).toEqual([
      [true, 'resuelto'],
      [false, 'abierto'],
    ]);
    expect(all[0]?.resolution).toBe('reemplazada');
    expect(second.opened).toHaveLength(1);
    expect(second.opened[0]?.proposalId).toBe(second.proposalId);
  });

  it('un solapamiento descartado no se vuelve a abrir con la misma pareja y celda', async () => {
    const ctx = await setup();
    const first = await shaftProposal(ctx);
    for (const validatorId of ['fernanda', 'javier']) {
      await ctx.voteOverlap.execute({
        overlapId: first.opened[0]!.id,
        validatorId,
        kind: 'no_se_tocan',
      });
    }
    const second = await submit(ctx, 'a201', 'rev E', 'fernanda', ['paula']);
    expect(second.opened).toEqual([]);
  });
});

describe('lectura', () => {
  it('lista por estado y los activos', async () => {
    const ctx = await setup();
    const { opened } = await shaftProposal(ctx);
    await ctx.voteOverlap.execute({
      overlapId: opened[0]!.id,
      validatorId: 'javier',
      kind: 'se_tocan',
    });
    expect(
      await ctx.listOverlaps.execute({ status: 'confirmado' }),
    ).toHaveLength(1);
    expect(await ctx.listOverlaps.execute({ status: 'abierto' })).toHaveLength(
      0,
    );
    expect(await ctx.listOverlaps.execute({ status: 'activo' })).toHaveLength(
      1,
    );
    expect(await ctx.listOverlaps.execute()).toHaveLength(1);
  });

  it('el sello exige que no quede ninguno abierto ni confirmado', async () => {
    const ctx = await setup();
    const { proposalId, opened } = await shaftProposal(ctx, ['paula']);
    await approveAll(ctx, proposalId!, ['paula']);
    for (const validatorId of ['fernanda', 'javier']) {
      await ctx.voteOverlap.execute({
        overlapId: opened[0]!.id,
        validatorId,
        kind: 'no_se_tocan',
      });
    }
    await ctx.settle.execute();
    expect((await ctx.consensus.execute()).index).toMatchObject({
      openOverlaps: 0,
      sealed: true,
    });
  });

  it('con un solapamiento vivo el índice cuenta uno y no hay sello', async () => {
    const ctx = await setup();
    await shaftProposal(ctx);
    const consensus = await ctx.consensus.execute();
    expect(consensus.index).toMatchObject({ openOverlaps: 1, sealed: false });
    expect(consensus.openOverlaps).toHaveLength(1);
  });
});
