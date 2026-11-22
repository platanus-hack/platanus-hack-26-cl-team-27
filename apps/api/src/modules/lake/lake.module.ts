import {
  AcknowledgeStale,
  DetectChanges,
  DismissDiscrepancy,
  type FactExtractor,
  GetChange,
  GetConsensus,
  GetProvenance,
  IngestRevision,
  ListChanges,
  ListOverlaps,
  ListProposals,
  OpenOverlaps,
  OpenProposal,
  RecordReview,
  ReopenProposal,
  ResolveOverlaps,
  SettleOverlaps,
  VoteOverlap,
  WithdrawProposal,
} from '@team27/context-lake';
import {
  InlineFactExtractor,
  PrismaAcknowledgementRepository,
  PrismaBaselineRepository,
  PrismaChangeRepository,
  PrismaChunkRepository,
  PrismaClaimRepository,
  PrismaDiscrepancyRepository,
  PrismaOverlapRepository,
  PrismaProposalRepository,
  PrismaRevisionRepository,
} from '@team27/context-lake/adapters';
import type { PrismaClient } from '@team27/data-main';

import type { ProjectCatalog } from '../project/project-catalog.ts';

export const buildLake = (
  db: PrismaClient,
  project: ProjectCatalog,
  extractor: FactExtractor = new InlineFactExtractor([]),
) => {
  const { footprintModel } = project;
  const revisions = new PrismaRevisionRepository(db, project.id);
  const chunks = new PrismaChunkRepository(db, project.id);
  const claims = new PrismaClaimRepository(db, project.id);
  const baseline = new PrismaBaselineRepository(db, project.id);
  const proposals = new PrismaProposalRepository(db, project.id);
  const discrepancies = new PrismaDiscrepancyRepository(db, project.id);
  const acknowledgements = new PrismaAcknowledgementRepository(db, project.id);
  const overlaps = new PrismaOverlapRepository(db, project.id);
  const changes = new PrismaChangeRepository(db, project.id);
  const resolveOverlaps = new ResolveOverlaps(
    baseline,
    proposals,
    overlaps,
    footprintModel,
  );
  return {
    ports: {
      revisions,
      chunks,
      claims,
      baseline,
      proposals,
      discrepancies,
      overlaps,
    },
    detectChanges: new DetectChanges(changes),
    listChanges: new ListChanges(changes),
    getChange: new GetChange(changes),
    ingestRevision: new IngestRevision(
      revisions,
      chunks,
      claims,
      baseline,
      proposals,
      discrepancies,
      extractor,
    ),
    getProvenance: new GetProvenance(
      revisions,
      claims,
      baseline,
      proposals,
      discrepancies,
    ),
    listProposals: new ListProposals(proposals),
    openProposal: new OpenProposal(proposals, baseline),
    recordReview: new RecordReview(proposals, baseline, overlaps),
    reopenProposal: new ReopenProposal(proposals),
    withdrawProposal: new WithdrawProposal(proposals),
    dismissDiscrepancy: new DismissDiscrepancy(discrepancies),
    listOverlaps: new ListOverlaps(overlaps),
    openOverlaps: new OpenOverlaps(
      revisions,
      claims,
      baseline,
      proposals,
      overlaps,
      footprintModel,
    ),
    voteOverlap: new VoteOverlap(overlaps),
    resolveOverlaps,
    settleOverlaps: new SettleOverlaps(
      proposals,
      baseline,
      overlaps,
      resolveOverlaps,
    ),
    acknowledgeStale: new AcknowledgeStale(
      revisions,
      claims,
      baseline,
      proposals,
      acknowledgements,
    ),
    consensus: new GetConsensus(
      revisions,
      claims,
      baseline,
      proposals,
      discrepancies,
      acknowledgements,
      overlaps,
    ),
  };
};

export type Lake = ReturnType<typeof buildLake>;
