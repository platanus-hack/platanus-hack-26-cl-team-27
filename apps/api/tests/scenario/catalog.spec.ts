import { diffSnapshots } from '@team27/context-capture';
import { analyzeChange } from '@team27/context-impact';
import {
  AUTHORITY,
  GetConsensus,
  IngestRevision,
  OpenProposal,
  type Proposal,
  RecordReview,
  ReopenProposal,
  SeedLake,
} from '@team27/context-lake';
import { FixtureFactExtractor } from '@team27/context-lake/adapters';

import { elementsFromBaseline } from '../../src/modules/coordination/elements-from-baseline.ts';
import {
  DOCUMENTS,
  fixtureCatalog,
  FIXTURES,
  fixtureRevision,
  SEEDED_REVISIONS,
  seededRevisions,
  SPACES,
  SUBJECTS,
} from '../../src/scenario/documents.ts';
import { LOS_AROMOS } from '../../src/scenario/los-aromos.ts';
import {
  InMemoryAcknowledgements,
  InMemoryBaseline,
  InMemoryClaims,
  InMemoryDiscrepancies,
  InMemoryProposals,
  InMemoryRevisions,
} from './inMemoryLake.ts';

const lakeUnderTest = () => {
  const revisions = new InMemoryRevisions();
  const claims = new InMemoryClaims();
  const baseline = new InMemoryBaseline();
  const proposals = new InMemoryProposals();
  const discrepancies = new InMemoryDiscrepancies();
  const acknowledgements = new InMemoryAcknowledgements();
  const extractor = new FixtureFactExtractor(fixtureCatalog());
  const ingest = new IngestRevision(
    revisions,
    claims,
    baseline,
    proposals,
    discrepancies,
    extractor,
  );
  const open = new OpenProposal(proposals, baseline);
  const review = new RecordReview(proposals, baseline);
  const reopen = new ReopenProposal(proposals);
  const consensus = new GetConsensus(
    revisions,
    claims,
    baseline,
    proposals,
    discrepancies,
    acknowledgements,
  );

  const impacts = new Map<string, ReturnType<typeof analyzeChange>>();

  const drop = async (fixtureId: string) => {
    const fixture = FIXTURES.find((candidate) => candidate.id === fixtureId);
    if (!fixture) throw new Error(`No existe ${fixtureId}`);
    const ingested = await ingest.execute(fixtureRevision(fixture));
    const entries = await baseline.list();
    const opened: Proposal[] = [];
    for (const draft of ingested.drafts) {
      const base = elementsFromBaseline(LOS_AROMOS.model, entries).filter(
        (element) => element.id === draft.subject,
      );
      const next = elementsFromBaseline(LOS_AROMOS.model, entries, {
        [draft.subject]: draft.after,
      }).filter((element) => element.id === draft.subject);
      const [change] = diffSnapshots(base, next, draft.sourceRevisionId);
      if (!change) throw new Error(`Sin cambio para ${draft.subject}`);
      const impact = analyzeChange(
        {
          id: `change-${opened.length}-${fixtureId}`,
          elementId: change.element.id,
          elementName: change.element.name,
          category: change.element.category,
          changedKeys: change.diffs.map((diff) => diff.key),
          before: change.before,
          after: change.after,
        },
        LOS_AROMOS.graph,
      );
      const { proposal } = await open.execute({
        draft,
        changeId: impact.changeId,
        reviewerIds: [
          ...new Set(impact.findings.map((finding) => finding.stakeholderId)),
        ],
        filtered: impact.filtered.map((item) => ({
          id: item.stakeholderId,
          reason: item.reason,
        })),
      });
      impacts.set(proposal.id, impact);
      opened.push(proposal);
    }
    return { ingested, opened };
  };

  const settle = async () => {
    for (const proposal of await proposals.listActive()) {
      const disputer =
        proposal.subject === 'losa-n3'
          ? 'paula-rojas'
          : proposal.subject === 'shaft-s1'
            ? 'javier-munoz'
            : null;
      for (const { reviewerId } of proposal.reviews) {
        if (reviewerId === disputer) continue;
        await review.execute({
          proposalId: proposal.id,
          reviewerId,
          decision: 'approve',
        });
      }
      if (disputer) {
        await review.execute({
          proposalId: proposal.id,
          reviewerId: disputer,
          decision: 'dispute',
          note: 'Necesito dos días',
        });
        await reopen.execute({ proposalId: proposal.id });
        await review.execute({
          proposalId: proposal.id,
          reviewerId: disputer,
          decision: 'approve',
        });
      }
    }
  };

  const seed = () =>
    new SeedLake(
      revisions,
      claims,
      baseline,
      proposals,
      discrepancies,
      acknowledgements,
    ).execute({ revisions: seededRevisions() });

  return {
    drop,
    settle,
    seed,
    baseline,
    proposals,
    consensus: () => consensus.execute(),
    impacts,
  };
};

const SCENES = [
  'e102-revC',
  'presupuesto-v3',
  'wa-ventanas-150',
  'a201-revC',
  'q118-rev2',
  'gantt-v5',
  'eett03-revB',
];

const EXTRAS = ['libro-f44-shaft', 'a201-revD'];

describe('catálogo del escenario', () => {
  it('cada fixture apunta a un documento, un espacio, un asiento y sujetos que existen', () => {
    const subjects = new Set(SUBJECTS.map((subject) => subject.id));
    const spaces = new Set(SPACES.map((space) => space.id));
    const cast = new Set(LOS_AROMOS.cast.map((member) => member.id));
    for (const fixture of FIXTURES) {
      expect(DOCUMENTS.some((doc) => doc.id === fixture.documentId)).toBe(true);
      expect(spaces.has(fixture.spaceId)).toBe(true);
      expect(cast.has(fixture.seat)).toBe(true);
      for (const claim of fixture.claims) {
        expect(subjects.has(claim.subject)).toBe(true);
        expect(AUTHORITY[claim.attribute]).toBeDefined();
      }
      for (const requirement of fixture.requires) {
        expect(
          FIXTURES.some(
            (candidate) =>
              candidate.documentId === requirement.documentId &&
              candidate.label === requirement.label,
          ) ||
            SEEDED_REVISIONS.some(
              (seed) =>
                seed.documentId === requirement.documentId &&
                seed.label === requirement.label,
            ),
        ).toBe(true);
      }
    }
  });

  it('Fernanda es del elenco pero no recibe avisos', () => {
    expect(LOS_AROMOS.cast.map((member) => member.id)).toContain(
      'fernanda-lagos',
    );
    expect(
      LOS_AROMOS.stakeholders.map((stakeholder) => stakeholder.id),
    ).not.toContain('fernanda-lagos');
  });

  it('la siembra deja nueve documentos al día y la obra consensuada', async () => {
    const lake = lakeUnderTest();

    const seeded = await lake.seed();
    const { index } = await lake.consensus();

    expect(seeded.baseline.length).toBeGreaterThanOrEqual(15);
    expect(index).toMatchObject({ upToDate: 9, total: 9, sealed: true });
    expect(
      (await lake.baseline.list()).every((entry) => entry.version === 1),
    ).toBe(true);
  });

  it('losa de 15 a 20 cm: +$3.636.500, +1 día y 4 de 7 avisados', async () => {
    const lake = lakeUnderTest();
    await lake.seed();

    const { opened } = await lake.drop('e102-revC');
    const proposal = opened[0];
    const impact = proposal ? lake.impacts.get(proposal.id) : undefined;

    expect(opened).toHaveLength(1);
    expect(impact?.costDelta).toBe(3_636_500);
    expect(impact?.delayDays).toBe(1);
    expect(proposal?.reviews.map((item) => item.reviewerId).sort()).toEqual([
      'daniela-soto',
      'javier-munoz',
      'marcos-fuentes',
      'paula-rojas',
    ]);
  });

  it('ventanas de 120 a 150 cm: +$1.998.000, 4 avisados y Marcos filtrado por la holgura', async () => {
    const lake = lakeUnderTest();
    await lake.seed();

    await lake.drop('wa-ventanas-150');
    const { ingested, opened } = await lake.drop('a201-revC');
    const proposal = opened[0];
    const impact = proposal ? lake.impacts.get(proposal.id) : undefined;

    expect(ingested.backedDiscrepancies).toHaveLength(1);
    expect(impact?.costDelta).toBe(1_998_000);
    expect(impact?.delayDays).toBe(0);
    expect(proposal?.reviews.map((item) => item.reviewerId).sort()).toEqual([
      'daniela-soto',
      'paula-rojas',
      'tomas-reyes',
      'ventanas-quillay',
    ]);
    expect(proposal?.filtered).toEqual([
      expect.objectContaining({
        id: 'marcos-fuentes',
        reason: expect.stringContaining('38 días de holgura'),
      }),
    ]);
  });

  it('shaft de 6 a 8,5 m: 3 avisados, sin costo ni atraso', async () => {
    const lake = lakeUnderTest();
    await lake.seed();

    await lake.drop('a201-revC');
    await lake.settle();
    await lake.drop('libro-f44-shaft');
    const { opened } = await lake.drop('a201-revD');
    const proposal = opened[0];
    const impact = proposal ? lake.impacts.get(proposal.id) : undefined;

    expect(opened).toHaveLength(1);
    expect(impact?.costDelta).toBe(0);
    expect(impact?.delayDays).toBe(0);
    expect(proposal?.reviews.map((item) => item.reviewerId).sort()).toEqual([
      'camila-vera',
      'javier-munoz',
      'paula-rojas',
    ]);
  });

  it('las escenas s1 a s6 terminan con la obra consensuada', async () => {
    const lake = lakeUnderTest();
    await lake.seed();

    for (const fixtureId of SCENES) {
      await lake.drop(fixtureId);
      await lake.settle();
    }
    const { index, stale } = await lake.consensus();

    expect(index).toMatchObject({
      upToDate: 9,
      total: 9,
      openProposals: 0,
      openDiscrepancies: 0,
      staleDocuments: 0,
      sealed: true,
    });
    expect(stale).toEqual([]);
  });

  it('con los extras del libro y el plano rev D también termina consensuada', async () => {
    const lake = lakeUnderTest();
    await lake.seed();

    for (const fixtureId of [...SCENES, ...EXTRAS]) {
      await lake.drop(fixtureId);
      await lake.settle();
    }

    expect((await lake.consensus()).index.sealed).toBe(true);
  });

  it('al fusionar la losa quedan desfasados la EETT, el presupuesto y la Carta Gantt', async () => {
    const lake = lakeUnderTest();
    await lake.seed();

    await lake.drop('e102-revC');
    await lake.settle();
    const { stale } = await lake.consensus();

    expect(stale.map((document) => document.documentId).sort()).toEqual([
      'eett03',
      'gantt',
      'presupuesto',
    ]);
  });

  it('al fusionar las ventanas la cotización se suma a lo que sigue desfasado', async () => {
    const lake = lakeUnderTest();
    await lake.seed();

    for (const fixtureId of [
      'e102-revC',
      'presupuesto-v3',
      'wa-ventanas-150',
    ]) {
      await lake.drop(fixtureId);
      await lake.settle();
    }
    await lake.drop('a201-revC');
    await lake.settle();
    const { stale } = await lake.consensus();

    expect(stale.map((document) => document.documentId).sort()).toEqual([
      'eett03',
      'gantt',
      'q118',
    ]);
  });
});
