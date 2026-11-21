import { ValidationError } from '../../src/application/errors.ts';
import { GetBaseline } from '../../src/application/use-cases/GetBaseline.ts';
import { GetProvenance } from '../../src/application/use-cases/GetProvenance.ts';
import { ReopenProposal } from '../../src/application/use-cases/ReopenProposal.ts';
import { WithdrawProposal } from '../../src/application/use-cases/WithdrawProposal.ts';
import { DismissDiscrepancy } from '../../src/application/use-cases/DismissDiscrepancy.ts';
import { ListProposals } from '../../src/application/use-cases/ListProposals.ts';
import type { ProposalDraft } from '../../src/domain/Proposal.ts';
import { chunksFromClaims } from '../../src/domain/Chunk.ts';
import { afirma, buildLake, draftOf, usa } from '../scenario.ts';

const catalog = {
  'e102@rev C': [afirma('losa-n3', 'espesor_cm', 20)],
  'wa@msg 1': [afirma('ventanas-norte', 'ancho_cm', 150)],
  'a201@rev C': [
    afirma('ventanas-norte', 'ancho_cm', 150),
    afirma('shaft-s1', 'posicion_m', 6),
  ],
  'presupuesto@v3': [
    afirma('partida-07.01', 'precio_unitario', 100),
    usa('losa-n3', 'espesor_cm', 20),
    usa('ventanas-norte', 'ancho_cm', 120),
  ],
  'presupuesto@v4': [
    afirma('partida-07.01', 'precio_unitario', 100),
    usa('losa-n3', 'espesor_cm', 20),
    usa('ventanas-norte', 'ancho_cm', 150),
  ],
};

const seedInput = {
  revisions: [
    {
      revision: draftOf('e102', 'rev B', 'plano'),
      chunks: chunksFromClaims([afirma('losa-n3', 'espesor_cm', 15)]),
    },
    {
      revision: draftOf('a201', 'rev B', 'plano'),
      chunks: chunksFromClaims([
        afirma('ventanas-norte', 'ancho_cm', 120),
        afirma('shaft-s1', 'posicion_m', 6),
      ]),
    },
    {
      revision: draftOf('eett', 'rev A', 'eett', 'paula'),
      chunks: chunksFromClaims([afirma('losa-n3', 'espesor_cm', 15)]),
    },
    {
      revision: draftOf('presupuesto', 'v2', 'presupuesto', 'daniela'),
      chunks: chunksFromClaims([
        afirma('partida-07.01', 'precio_unitario', 100),
        usa('losa-n3', 'espesor_cm', 15),
        usa('ventanas-norte', 'ancho_cm', 120),
      ]),
    },
    {
      revision: draftOf('wa', 'base', 'mensaje', 'marcos'),
      chunks: chunksFromClaims([]),
    },
  ],
};

const setup = async () => {
  const ctx = buildLake(catalog);
  await ctx.seed.execute(seedInput);
  return ctx;
};

const slabDraft = async (ctx: Awaited<ReturnType<typeof setup>>) => {
  const ingested = await ctx.ingest.execute(draftOf('e102', 'rev C', 'plano'));
  return ingested.draft as ProposalDraft;
};

describe('SeedLake', () => {
  it('siembra la base con la primera revisión con autoridad de cada valor', async () => {
    const { seed, lake } = await setup().then((ctx) => ({
      seed: ctx.seed,
      lake: ctx.lake,
    }));
    const entries = await lake.baseline.list();
    expect(
      entries
        .map((e) => `${e.subject}.${e.attribute}=${String(e.value)}`)
        .sort(),
    ).toEqual([
      'losa-n3.espesor_cm=15',
      'partida-07.01.precio_unitario=100',
      'shaft-s1.posicion_m=6',
      'ventanas-norte.ancho_cm=120',
    ]);
    const again = await seed.execute(seedInput);
    expect(again.baseline).toHaveLength(4);
    expect(await lake.revisions.list()).toHaveLength(5);
  });

  it('rechaza una base con dos valores con autoridad distintos', async () => {
    const { seed } = buildLake();
    await expect(
      seed.execute({
        revisions: [
          {
            revision: draftOf('a', '1', 'plano'),
            chunks: chunksFromClaims([afirma('s', 'espesor_cm', 1)]),
          },
          {
            revision: draftOf('b', '1', 'eett'),
            chunks: chunksFromClaims([afirma('s', 'espesor_cm', 2)]),
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('la base queda al día: nada desfasado ni abierto', async () => {
    const ctx = await setup();
    expect(await ctx.stale.execute()).toEqual([]);
    expect((await ctx.consensus.execute()).index).toMatchObject({
      upToDate: 5,
      total: 5,
      sealed: true,
    });
  });
});

describe('IngestRevision', () => {
  it('devuelve un solo borrador por revisión, con antes y después, sin conocer a nadie más', async () => {
    const ctx = await setup();
    const result = await ctx.ingest.execute(draftOf('e102', 'rev C', 'plano'));
    expect(result.alreadyIngested).toBe(false);
    expect(result.outcomes.map((o) => o.kind)).toEqual(['change']);
    expect(result.draft).toEqual(
      expect.objectContaining({
        documentId: 'e102',
        before: { 'losa-n3': { espesor_cm: 15 } },
        after: { 'losa-n3': { espesor_cm: 20 } },
        authorId: 'fernanda',
        sourceRevisionId: result.revision.id,
      }),
    );
    expect(result.draft?.changes).toEqual([
      expect.objectContaining({
        subject: 'losa-n3',
        attribute: 'espesor_cm',
        locator: 'losa-n3.espesor_cm',
      }),
    ]);
    expect(await ctx.lake.proposals.list()).toEqual([]);
  });

  it('es idempotente: la misma revisión no se ingiere dos veces', async () => {
    const ctx = await setup();
    const first = await ctx.ingest.execute(draftOf('e102', 'rev C', 'plano'));
    const second = await ctx.ingest.execute(draftOf('e102', 'rev C', 'plano'));
    expect(second).toMatchObject({
      alreadyIngested: true,
      draft: null,
      outcomes: [],
    });
    expect(second.revision.id).toBe(first.revision.id);
    expect(ctx.lake.revisions.save).toHaveBeenCalledTimes(
      seedInput.revisions.length + 1,
    );
  });

  it('un mensaje abre una discrepancia para el dueño del valor y el plano la respalda', async () => {
    const ctx = await setup();
    const message = await ctx.ingest.execute(
      draftOf('wa', 'msg 1', 'mensaje', 'marcos'),
    );
    expect(message.draft).toBeNull();
    expect(message.openedDiscrepancies).toEqual([
      expect.objectContaining({
        subject: 'ventanas-norte',
        value: 150,
        baselineValue: 120,
        ownerId: 'fernanda',
        documentId: 'wa',
        status: 'open',
      }),
    ]);
    expect((await ctx.consensus.execute()).index.openDiscrepancies).toBe(1);

    const plan = await ctx.ingest.execute(draftOf('a201', 'rev C', 'plano'));
    expect(plan.draft?.changes).toHaveLength(1);
    expect(plan.backedDiscrepancies).toEqual([
      expect.objectContaining({
        status: 'backed',
        backedByRevisionId: plan.revision.id,
      }),
    ]);
    expect((await ctx.consensus.execute()).index.openDiscrepancies).toBe(0);
  });

  it('no duplica la discrepancia si el mismo valor ya está abierto', async () => {
    const ctx = await setup();
    await ctx.ingest.execute(draftOf('wa', 'msg 1', 'mensaje', 'marcos'));
    const again = await ctx.ingest.execute(
      draftOf('wa', 'msg 1b', 'mensaje', 'marcos'),
    );
    expect(again.openedDiscrepancies).toEqual([]);
    expect(ctx.lake.discrepancies.create).toHaveBeenCalledTimes(0 + 1);
  });

  it('rechaza una revisión que repite un hecho', async () => {
    const ctx = buildLake({
      'x@1': [afirma('s', 'espesor_cm', 1), afirma('s', 'espesor_cm', 2)],
    });
    await expect(
      ctx.ingest.execute(draftOf('x', '1', 'plano')),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('un hecho que usa un valor distinto de lo vigente deja el documento desfasado desde el ingreso', async () => {
    const ctx = await setup();
    const result = await ctx.ingest.execute(
      draftOf('presupuesto', 'v3', 'presupuesto', 'daniela'),
    );
    expect(result.outcomes.map((o) => o.kind)).toEqual([
      'same',
      'stale',
      'uses_current',
    ]);
    const stale = await ctx.stale.execute();
    expect(stale.map((d) => d.documentId)).toEqual(['presupuesto']);
  });
});

describe('propuestas y consenso', () => {
  it('fusiona cuando todos aprueban y guarda el valor anterior en el historial', async () => {
    const ctx = await setup();
    const draft = await slabDraft(ctx);
    const { proposal } = await ctx.open.execute({
      draft,
      changeId: 'c1',
      reviewerIds: ['paula', 'javier'],
      filtered: [{ id: 'camila', reason: 'No le afecta' }],
    });
    expect(proposal).toMatchObject({ status: 'open', changeId: 'c1' });

    const first = await ctx.review.execute({
      proposalId: proposal.id,
      reviewerId: 'paula',
      decision: 'approve',
    });
    expect(first).toMatchObject({ changed: true, merged: false });
    expect((await ctx.lake.baseline.find('losa-n3', 'espesor_cm'))?.value).toBe(
      15,
    );

    const last = await ctx.review.execute({
      proposalId: proposal.id,
      reviewerId: 'javier',
      decision: 'approve',
      note: ' listo ',
    });
    expect(last).toMatchObject({ changed: true, merged: true });
    expect(last.proposal.status).toBe('merged');
    expect(last.proposal.reviews[1]?.note).toBe('listo');
    const merged = await ctx.lake.baseline.find('losa-n3', 'espesor_cm');
    expect(merged).toMatchObject({
      value: 20,
      version: 2,
      proposalId: proposal.id,
    });
    expect(await ctx.lake.baseline.history('losa-n3', 'espesor_cm')).toEqual([
      expect.objectContaining({ value: 15 }),
    ]);
  });

  it('una disputa no cambia lo vigente; reabrir limpia al que disputó y aprobar fusiona', async () => {
    const ctx = await setup();
    const { proposal } = await ctx.open.execute({
      draft: await slabDraft(ctx),
      changeId: 'c1',
      reviewerIds: ['paula', 'javier'],
      filtered: [],
    });
    await ctx.review.execute({
      proposalId: proposal.id,
      reviewerId: 'javier',
      decision: 'approve',
    });
    const disputed = await ctx.review.execute({
      proposalId: proposal.id,
      reviewerId: 'paula',
      decision: 'dispute',
      note: 'Necesito 2 días',
    });
    expect(disputed.proposal.status).toBe('disputed');
    expect((await ctx.lake.baseline.find('losa-n3', 'espesor_cm'))?.value).toBe(
      15,
    );
    expect((await ctx.consensus.execute()).index.sealed).toBe(false);

    const reopen = new ReopenProposal(ctx.lake.proposals);
    await expect(
      reopen.execute({ proposalId: proposal.id, actorId: 'paula' }),
    ).rejects.toBeInstanceOf(ValidationError);
    const reopened = await reopen.execute({
      proposalId: proposal.id,
      actorId: 'fernanda',
    });
    expect(reopened.reopenedReviewerIds).toEqual(['paula']);
    expect(reopened.proposal.status).toBe('open');
    expect(
      reopened.proposal.reviews.find((r) => r.reviewerId === 'javier')
        ?.decision,
    ).toBe('approve');

    await expect(
      reopen.execute({ proposalId: proposal.id }),
    ).rejects.toBeInstanceOf(ValidationError);
    const done = await ctx.review.execute({
      proposalId: proposal.id,
      reviewerId: 'paula',
      decision: 'approve',
    });
    expect(done.merged).toBe(true);
  });

  it('las respuestas son idempotentes y no se pueden cambiar', async () => {
    const ctx = await setup();
    const { proposal } = await ctx.open.execute({
      draft: await slabDraft(ctx),
      changeId: null,
      reviewerIds: ['paula', 'javier'],
      filtered: [],
    });
    await ctx.review.execute({
      proposalId: proposal.id,
      reviewerId: 'paula',
      decision: 'approve',
    });
    const repeated = await ctx.review.execute({
      proposalId: proposal.id,
      reviewerId: 'paula',
      decision: 'approve',
    });
    expect(repeated.changed).toBe(false);
    await expect(
      ctx.review.execute({
        proposalId: proposal.id,
        reviewerId: 'paula',
        decision: 'dispute',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      ctx.review.execute({
        proposalId: proposal.id,
        reviewerId: 'tomas',
        decision: 'approve',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      ctx.review.execute({
        proposalId: 'nope',
        reviewerId: 'paula',
        decision: 'approve',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('con cero revisores se fusiona de inmediato', async () => {
    const ctx = await setup();
    const { proposal } = await ctx.open.execute({
      draft: await slabDraft(ctx),
      changeId: null,
      reviewerIds: [],
      filtered: [{ id: 'paula', reason: 'No le afecta' }],
    });
    expect(proposal.status).toBe('merged');
    expect((await ctx.lake.baseline.find('losa-n3', 'espesor_cm'))?.value).toBe(
      20,
    );
  });

  it('una propuesta nueva sobre el mismo valor reemplaza a la abierta y sus votos parten limpios', async () => {
    const ctx = await setup();
    const draft = await slabDraft(ctx);
    const first = await ctx.open.execute({
      draft,
      changeId: 'c1',
      reviewerIds: ['paula'],
      filtered: [],
    });
    await ctx.review.execute({
      proposalId: first.proposal.id,
      reviewerId: 'paula',
      decision: 'dispute',
    });
    const second = await ctx.open.execute({
      draft: {
        ...draft,
        changes: draft.changes.map((c) => ({ ...c, after: 22 })),
      },
      changeId: 'c2',
      reviewerIds: ['paula'],
      filtered: [],
    });
    expect(second.superseded.map((p) => p.id)).toEqual([first.proposal.id]);
    expect(await ctx.lake.proposals.findById(first.proposal.id)).toMatchObject({
      status: 'superseded',
      supersededById: second.proposal.id,
    });
    expect(second.proposal.reviews).toEqual([
      { reviewerId: 'paula', decision: null, note: null, at: null },
    ]);
    await expect(
      ctx.review.execute({
        proposalId: first.proposal.id,
        reviewerId: 'paula',
        decision: 'approve',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('el autor retira la propuesta y lo vigente no cambia', async () => {
    const ctx = await setup();
    const { proposal } = await ctx.open.execute({
      draft: await slabDraft(ctx),
      changeId: null,
      reviewerIds: ['paula'],
      filtered: [],
    });
    const withdraw = new WithdrawProposal(ctx.lake.proposals);
    await expect(
      withdraw.execute({ proposalId: proposal.id, actorId: 'paula' }),
    ).rejects.toBeInstanceOf(ValidationError);
    const withdrawn = await withdraw.execute({
      proposalId: proposal.id,
      actorId: 'fernanda',
    });
    expect(withdrawn.status).toBe('withdrawn');
    expect((await withdraw.execute({ proposalId: proposal.id })).status).toBe(
      'withdrawn',
    );
    expect((await ctx.lake.baseline.find('losa-n3', 'espesor_cm'))?.value).toBe(
      15,
    );
    await expect(
      ctx.review.execute({
        proposalId: proposal.id,
        reviewerId: 'paula',
        decision: 'approve',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rechaza propuestas vacías o con revisores repetidos', async () => {
    const ctx = await setup();
    const draft = await slabDraft(ctx);
    await expect(
      ctx.open.execute({
        draft: { ...draft, changes: [] },
        changeId: null,
        reviewerIds: [],
        filtered: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      ctx.open.execute({
        draft,
        changeId: null,
        reviewerIds: ['a', 'a'],
        filtered: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('lista propuestas por estado', async () => {
    const ctx = await setup();
    await ctx.open.execute({
      draft: await slabDraft(ctx),
      changeId: null,
      reviewerIds: ['paula'],
      filtered: [],
    });
    const list = new ListProposals(ctx.lake.proposals);
    expect(await list.execute({ status: 'active' })).toHaveLength(1);
    expect(await list.execute({ status: 'merged' })).toHaveLength(0);
    expect(await list.execute()).toHaveLength(1);
  });
});

describe('desfase y confirmación sin cambio', () => {
  const mergeSlab = async (ctx: Awaited<ReturnType<typeof setup>>) => {
    await ctx.open.execute({
      draft: await slabDraft(ctx),
      changeId: null,
      reviewerIds: [],
      filtered: [],
    });
  };

  it('al fusionar quedan desfasados los documentos que afirman o usan el valor viejo', async () => {
    const ctx = await setup();
    await mergeSlab(ctx);
    const stale = await ctx.stale.execute();
    expect(stale.map((d) => d.documentId).sort()).toEqual([
      'eett',
      'presupuesto',
    ]);
    expect(stale.find((d) => d.documentId === 'eett')?.ownerId).toBe('paula');
  });

  it('una revisión nueva del documento lo cierra si coincide', async () => {
    const ctx = await setup();
    await mergeSlab(ctx);
    await ctx.ingest.execute(
      draftOf('presupuesto', 'v3', 'presupuesto', 'daniela'),
    );
    const stale = await ctx.stale.execute();
    expect(stale.map((d) => d.documentId)).toEqual(['eett']);
  });

  it('confirmar sin cambio exige una nota y es idempotente', async () => {
    const ctx = await setup();
    await mergeSlab(ctx);
    await expect(
      ctx.acknowledge.execute({
        documentId: 'eett',
        ownerId: 'paula',
        note: '  ',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      ctx.acknowledge.execute({
        documentId: 'e102',
        ownerId: 'fernanda',
        note: 'x',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    const first = await ctx.acknowledge.execute({
      documentId: 'eett',
      ownerId: 'paula',
      note: ' No cambia ',
    });
    const second = await ctx.acknowledge.execute({
      documentId: 'eett',
      ownerId: 'paula',
      note: 'otra',
    });
    expect(first.note).toBe('No cambia');
    expect(second.id).toBe(first.id);
    const stale = await ctx.stale.execute();
    expect(
      stale.find((d) => d.documentId === 'eett')?.acknowledgement,
    ).not.toBeNull();
  });

  it('se llega al sello: fusión, revisiones nuevas y confirmación sin cambio', async () => {
    const ctx = await setup();
    await ctx.ingest.execute(draftOf('wa', 'msg 1', 'mensaje', 'marcos'));
    const plan = await ctx.ingest.execute(draftOf('a201', 'rev C', 'plano'));
    await mergeSlab(ctx);
    for (const draft of plan.draft ? [plan.draft] : []) {
      await ctx.open.execute({
        draft,
        changeId: null,
        reviewerIds: [],
        filtered: [],
      });
    }
    expect((await ctx.consensus.execute()).index.sealed).toBe(false);
    await ctx.ingest.execute(
      draftOf('presupuesto', 'v4', 'presupuesto', 'daniela'),
    );
    expect((await ctx.consensus.execute()).index.sealed).toBe(false);
    await ctx.acknowledge.execute({
      documentId: 'eett',
      ownerId: 'paula',
      note: 'No cambia la EETT',
    });
    const consensus = await ctx.consensus.execute();
    expect(consensus.index).toMatchObject({
      sealed: true,
      upToDate: 5,
      total: 5,
    });
    expect(consensus.mergedProposals).toHaveLength(2);
  });
});

describe('DismissDiscrepancy', () => {
  it('el dueño descarta la discrepancia con una nota', async () => {
    const ctx = await setup();
    const { openedDiscrepancies } = await ctx.ingest.execute(
      draftOf('wa', 'msg 1', 'mensaje', 'marcos'),
    );
    const dismiss = new DismissDiscrepancy(ctx.lake.discrepancies);
    const id = openedDiscrepancies[0]!.id;
    await expect(
      dismiss.execute({ discrepancyId: id, actorId: 'marcos' }),
    ).rejects.toBeInstanceOf(ValidationError);
    const dismissed = await dismiss.execute({
      discrepancyId: id,
      actorId: 'fernanda',
      note: ' Era un error ',
    });
    expect(dismissed).toMatchObject({
      status: 'dismissed',
      note: 'Era un error',
    });
    expect((await dismiss.execute({ discrepancyId: id })).status).toBe(
      'dismissed',
    );
    await expect(
      dismiss.execute({ discrepancyId: 'nope' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await ctx.consensus.execute()).index.openDiscrepancies).toBe(0);
  });
});

describe('GetBaseline y GetProvenance', () => {
  it('lo vigente trae estado y fuentes', async () => {
    const ctx = await setup();
    const getBaseline = new GetBaseline(
      ctx.lake.revisions,
      ctx.lake.claims,
      ctx.lake.baseline,
      ctx.lake.proposals,
    );
    const before = await getBaseline.execute();
    const slab = (views: typeof before) =>
      views.find((v) => v.entry.subject === 'losa-n3')!;
    expect(slab(before)).toMatchObject({
      status: 'confirmed',
      sources: 2,
      proposalIds: [],
    });

    const { proposal } = await ctx.open.execute({
      draft: await slabDraft(ctx),
      changeId: null,
      reviewerIds: ['paula'],
      filtered: [],
    });
    expect(slab(await getBaseline.execute())).toMatchObject({
      status: 'proposed',
      proposalIds: [proposal.id],
    });
    await ctx.review.execute({
      proposalId: proposal.id,
      reviewerId: 'paula',
      decision: 'dispute',
    });
    expect(slab(await getBaseline.execute()).status).toBe('disputed');
  });

  it('la procedencia responde de dónde salió el valor', async () => {
    const ctx = await setup();
    const { proposal } = await ctx.open.execute({
      draft: await slabDraft(ctx),
      changeId: null,
      reviewerIds: ['paula'],
      filtered: [],
    });
    await ctx.review.execute({
      proposalId: proposal.id,
      reviewerId: 'paula',
      decision: 'approve',
      note: 'ok',
    });
    const provenance = new GetProvenance(
      ctx.lake.revisions,
      ctx.lake.claims,
      ctx.lake.baseline,
      ctx.lake.proposals,
      ctx.lake.discrepancies,
    );
    const result = await provenance.execute({
      subject: 'losa-n3',
      attribute: 'espesor_cm',
    });
    expect(result).toMatchObject({
      value: 20,
      status: 'confirmed',
      revision: { documentId: 'e102', label: 'rev C' },
      proposal: { id: proposal.id },
    });
    expect(result?.approvals[0]).toMatchObject({
      reviewerId: 'paula',
      note: 'ok',
    });
    expect(result?.previous[0]).toMatchObject({
      value: 15,
      revision: { label: 'rev B' },
    });
    expect(
      await provenance.execute({ subject: 'x', attribute: 'y' }),
    ).toBeNull();
  });
});
