import { buildProvenance } from '../../src/domain/buildProvenance.ts';
import { chunksFromClaims } from '../../src/domain/Chunk.ts';
import { ClearScope } from '../../src/application/use-cases/ClearScope.ts';
import { EnsureBaseline } from '../../src/application/use-cases/EnsureBaseline.ts';
import { RecordRevision } from '../../src/application/use-cases/RecordRevision.ts';
import type { ProposalChange } from '../../src/domain/Proposal.ts';
import { afirma, buildLake, draftOf } from '../scenario.ts';

const seed = (lake: ReturnType<typeof buildLake>['lake']) => ({
  ensure: new EnsureBaseline(
    lake.revisions,
    lake.chunks,
    lake.claims,
    lake.baseline,
  ),
  record: new RecordRevision(lake.revisions, lake.chunks, lake.claims),
  clear: new ClearScope(lake.revisions, lake.proposals, lake.baseline),
});

const baseInput = {
  revisions: [
    {
      revision: draftOf('est', 'base', 'plano', 'paula'),
      chunks: chunksFromClaims([afirma('caso.P-12', 'ubicacion_m', 'a')]),
    },
    {
      revision: draftOf('elec', 'base', 'plano', 'camila'),
      chunks: chunksFromClaims([afirma('caso.E-B-03', 'ubicacion_m', 'b')]),
    },
    {
      revision: draftOf('otro', 'base', 'plano', 'x'),
      chunks: chunksFromClaims([afirma('colector', 'ubicacion_m', 'c')]),
    },
  ],
};

describe('rebanada del caso', () => {
  it('RecordRevision es idempotente por documento y etiqueta y no toca lo vigente', async () => {
    const { lake } = buildLake();
    const { ensure, record } = seed(lake);
    await ensure.execute(baseInput);
    const input = {
      revision: draftOf('est', 'minuta-1', 'plano', 'paula'),
      chunks: chunksFromClaims([afirma('caso.P-12', 'ubicacion_m', 'a2')]),
    };
    const first = await record.execute(input);
    const again = await record.execute(input);
    expect(first.alreadyRecorded).toBe(false);
    expect(again.alreadyRecorded).toBe(true);
    expect(again.revision.id).toBe(first.revision.id);
    expect(
      (await lake.revisions.list()).filter((r) => r.label === 'minuta-1'),
    ).toHaveLength(1);
    expect((await lake.baseline.find('caso.P-12', 'ubicacion_m'))?.value).toBe(
      'a',
    );
  });

  it('EnsureBaseline siembra una sola vez', async () => {
    const { lake } = buildLake();
    const { ensure } = seed(lake);
    expect((await ensure.execute(baseInput)).seeded).toBe(3);
    expect((await ensure.execute(baseInput)).seeded).toBe(0);
    expect(await lake.baseline.list()).toHaveLength(3);
  });

  it('ClearScope borra solo el caso', async () => {
    const { lake } = buildLake();
    const { ensure, clear } = seed(lake);
    await ensure.execute(baseInput);
    await clear.execute({
      documentIds: ['est', 'elec'],
      subjectPrefix: 'caso.',
    });
    expect((await lake.revisions.list()).map((r) => r.documentId)).toEqual([
      'otro',
    ]);
    expect((await lake.baseline.list()).map((e) => e.subject)).toEqual([
      'colector',
    ]);
  });

  const hunks = async (lake: ReturnType<typeof buildLake>['lake']) => {
    const est = await record(lake, 'est', 'paula', 'caso.P-12', 'a2');
    const elec = await record(lake, 'elec', 'vigente', 'caso.E-B-03', 'b2');
    const change = (
      subject: string,
      before: string,
      after: string,
      r: typeof est,
    ): ProposalChange => ({
      subject,
      attribute: 'ubicacion_m',
      unit: 'm',
      before,
      after,
      claimId: r.claims[0]!.id,
      locator: 'x',
      revisionId: r.revision.id,
    });
    return {
      est,
      elec,
      changes: [
        change('caso.P-12', 'a', 'a2', est),
        change('caso.E-B-03', 'b', 'b2', elec),
      ],
    };
  };

  const record = (
    lake: ReturnType<typeof buildLake>['lake'],
    doc: string,
    author: string,
    subject: string,
    value: string,
  ) =>
    new RecordRevision(lake.revisions, lake.chunks, lake.claims).execute({
      revision: draftOf(doc, 'm1', 'plano', author),
      chunks: chunksFromClaims([afirma(subject, 'ubicacion_m', value)]),
    });

  const open = async (
    lake: ReturnType<typeof buildLake>['lake'],
    open: ReturnType<typeof buildLake>['open'],
  ) => {
    const { est, changes } = await hunks(lake);
    const { proposal } = await open.execute({
      draft: {
        documentId: 'est',
        sourceRevisionId: est.revision.id,
        authorId: 'paula',
        changes,
        context: [],
        before: {},
        after: {},
      },
      changeId: null,
      reviewerIds: ['camila'],
      filtered: [],
    });
    return proposal;
  };

  it('aprobar fusiona los dos hunks y la revisión del arreglo queda en lo vigente', async () => {
    const built = buildLake();
    const { lake } = built;
    await seed(lake).ensure.execute(baseInput);
    const proposal = await open(lake, built.open);
    expect((await lake.baseline.find('caso.P-12', 'ubicacion_m'))?.value).toBe(
      'a',
    );
    const result = await built.review.execute({
      proposalId: proposal.id,
      reviewerId: 'camila',
      decision: 'approve',
    });
    expect(result.merged).toBe(true);
    const elec = await lake.baseline.find('caso.E-B-03', 'ubicacion_m');
    const fixRevision = (await lake.revisions.list()).find(
      (r) => r.documentId === 'elec' && r.label === 'm1',
    );
    expect(elec?.value).toBe('b2');
    expect(elec?.revisionId).toBe(fixRevision?.id);
    const est = await lake.baseline.find('caso.P-12', 'ubicacion_m');
    expect(est?.revisionId).toBe(proposal.sourceRevisionId);
    expect(
      (await lake.baseline.history('caso.E-B-03', 'ubicacion_m'))[0]?.value,
    ).toBe('b');
    const provenance = buildProvenance({
      entry: elec!,
      history: await lake.baseline.history('caso.E-B-03', 'ubicacion_m'),
      revisions: await lake.revisions.list(),
      claims: await lake.claims.list(),
      proposals: await lake.proposals.list(),
      discrepancies: [],
    });
    expect(provenance.approvals[0]?.reviewerId).toBe('camila');
    expect(provenance.approvals[0]?.at).toBeInstanceOf(Date);
  });

  it('disputar deja lo vigente igual', async () => {
    const built = buildLake();
    const { lake } = built;
    await seed(lake).ensure.execute(baseInput);
    const proposal = await open(lake, built.open);
    const result = await built.review.execute({
      proposalId: proposal.id,
      reviewerId: 'camila',
      decision: 'dispute',
      note: 'no se puede',
    });
    expect(result.proposal.status).toBe('disputed');
    expect(result.proposal.reviews[0]?.note).toBe('no se puede');
    expect(
      (await lake.baseline.find('caso.E-B-03', 'ubicacion_m'))?.value,
    ).toBe('b');
  });
});
