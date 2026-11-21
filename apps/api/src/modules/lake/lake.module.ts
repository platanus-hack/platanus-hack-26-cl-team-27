import { Module } from '@nestjs/common';
import {
  AcknowledgeStale,
  DismissDiscrepancy,
  type FactExtractor,
  GetBaseline,
  GetConsensus,
  GetProvenance,
  IngestRevision,
  ListOverlaps,
  ListProposals,
  ListStale,
  OpenOverlaps,
  OpenProposal,
  RecordReview,
  ReopenProposal,
  ResolveOverlaps,
  SeedLake,
  SettleOverlaps,
  VoteOverlap,
  WithdrawProposal,
} from '@team27/context-lake';
import {
  InlineFactExtractor,
  PrismaAcknowledgementRepository,
  PrismaBaselineRepository,
  PrismaChunkRepository,
  PrismaClaimRepository,
  PrismaDiscrepancyRepository,
  PrismaOverlapRepository,
  PrismaProposalRepository,
  PrismaRevisionRepository,
} from '@team27/context-lake/adapters';
import type { PrismaClient } from '@team27/data-main';

import { provideUseCase } from '../../common/provide-use-case.ts';
import { footprintModel } from '../../scenario/areas.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';

export const REVISION_REPOSITORY = 'REVISION_REPOSITORY';
export const CHUNK_REPOSITORY = 'CHUNK_REPOSITORY';
export const CLAIM_REPOSITORY = 'CLAIM_REPOSITORY';
export const OVERLAP_REPOSITORY = 'OVERLAP_REPOSITORY';
export const BASELINE_REPOSITORY = 'BASELINE_REPOSITORY';
export const PROPOSAL_REPOSITORY = 'PROPOSAL_REPOSITORY';
export const DISCREPANCY_REPOSITORY = 'DISCREPANCY_REPOSITORY';
export const ACKNOWLEDGEMENT_REPOSITORY = 'ACKNOWLEDGEMENT_REPOSITORY';

export const buildLake = (
  db: PrismaClient,
  extractor: FactExtractor = new InlineFactExtractor([]),
) => {
  const revisions = new PrismaRevisionRepository(db);
  const chunks = new PrismaChunkRepository(db);
  const claims = new PrismaClaimRepository(db);
  const baseline = new PrismaBaselineRepository(db);
  const proposals = new PrismaProposalRepository(db);
  const discrepancies = new PrismaDiscrepancyRepository(db);
  const acknowledgements = new PrismaAcknowledgementRepository(db);
  const overlaps = new PrismaOverlapRepository(db);
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
    ingestRevision: new IngestRevision(
      revisions,
      chunks,
      claims,
      baseline,
      proposals,
      discrepancies,
      extractor,
    ),
    openProposal: new OpenProposal(proposals, baseline),
    recordReview: new RecordReview(proposals, baseline, overlaps),
    reopenProposal: new ReopenProposal(proposals),
    withdrawProposal: new WithdrawProposal(proposals),
    dismissDiscrepancy: new DismissDiscrepancy(discrepancies),
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
    seedLake: new SeedLake(
      revisions,
      chunks,
      claims,
      baseline,
      proposals,
      discrepancies,
      acknowledgements,
      overlaps,
    ),
  };
};

@Module({
  providers: [
    {
      provide: REVISION_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) =>
        new PrismaRevisionRepository(prisma),
    },
    {
      provide: CHUNK_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) => new PrismaChunkRepository(prisma),
    },
    {
      provide: OVERLAP_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) => new PrismaOverlapRepository(prisma),
    },
    {
      provide: CLAIM_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) => new PrismaClaimRepository(prisma),
    },
    {
      provide: BASELINE_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) =>
        new PrismaBaselineRepository(prisma),
    },
    {
      provide: PROPOSAL_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) =>
        new PrismaProposalRepository(prisma),
    },
    {
      provide: DISCREPANCY_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) =>
        new PrismaDiscrepancyRepository(prisma),
    },
    {
      provide: ACKNOWLEDGEMENT_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) =>
        new PrismaAcknowledgementRepository(prisma),
    },
    provideUseCase(OpenProposal, [PROPOSAL_REPOSITORY, BASELINE_REPOSITORY]),
    provideUseCase(RecordReview, [
      PROPOSAL_REPOSITORY,
      BASELINE_REPOSITORY,
      OVERLAP_REPOSITORY,
    ]),
    provideUseCase(ReopenProposal, [PROPOSAL_REPOSITORY]),
    provideUseCase(WithdrawProposal, [PROPOSAL_REPOSITORY]),
    provideUseCase(DismissDiscrepancy, [DISCREPANCY_REPOSITORY]),
    provideUseCase(AcknowledgeStale, [
      REVISION_REPOSITORY,
      CLAIM_REPOSITORY,
      BASELINE_REPOSITORY,
      PROPOSAL_REPOSITORY,
      ACKNOWLEDGEMENT_REPOSITORY,
    ]),
    provideUseCase(GetBaseline, [
      REVISION_REPOSITORY,
      CLAIM_REPOSITORY,
      BASELINE_REPOSITORY,
      PROPOSAL_REPOSITORY,
    ]),
    provideUseCase(GetProvenance, [
      REVISION_REPOSITORY,
      CLAIM_REPOSITORY,
      BASELINE_REPOSITORY,
      PROPOSAL_REPOSITORY,
      DISCREPANCY_REPOSITORY,
    ]),
    provideUseCase(ListStale, [
      REVISION_REPOSITORY,
      CLAIM_REPOSITORY,
      BASELINE_REPOSITORY,
      PROPOSAL_REPOSITORY,
      ACKNOWLEDGEMENT_REPOSITORY,
    ]),
    provideUseCase(ListProposals, [PROPOSAL_REPOSITORY]),
    provideUseCase(ListOverlaps, [OVERLAP_REPOSITORY]),
    provideUseCase(GetConsensus, [
      REVISION_REPOSITORY,
      CLAIM_REPOSITORY,
      BASELINE_REPOSITORY,
      PROPOSAL_REPOSITORY,
      DISCREPANCY_REPOSITORY,
      ACKNOWLEDGEMENT_REPOSITORY,
      OVERLAP_REPOSITORY,
    ]),
  ],
  exports: [
    REVISION_REPOSITORY,
    CHUNK_REPOSITORY,
    OVERLAP_REPOSITORY,
    CLAIM_REPOSITORY,
    BASELINE_REPOSITORY,
    DISCREPANCY_REPOSITORY,
    PROPOSAL_REPOSITORY,
    GetBaseline,
    GetProvenance,
    ListStale,
    ListProposals,
    ListOverlaps,
    GetConsensus,
  ],
})
export class LakeModule {}
