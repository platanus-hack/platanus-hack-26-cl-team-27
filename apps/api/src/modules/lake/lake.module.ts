import { Module } from '@nestjs/common';
import {
  AcknowledgeStale,
  DismissDiscrepancy,
  GetBaseline,
  GetConsensus,
  GetProvenance,
  IngestRevision,
  ListProposals,
  ListStale,
  OpenProposal,
  RecordReview,
  ReopenProposal,
  SeedLake,
  WithdrawProposal,
} from '@team27/context-lake';
import {
  FixtureFactExtractor,
  PrismaAcknowledgementRepository,
  PrismaBaselineRepository,
  PrismaClaimRepository,
  PrismaDiscrepancyRepository,
  PrismaProposalRepository,
  PrismaRevisionRepository,
} from '@team27/context-lake/adapters';
import type { PrismaClient } from '@team27/data-main';

import { provideUseCase } from '../../common/provide-use-case.ts';
import { fixtureCatalog } from '../../scenario/documents.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';

export const REVISION_REPOSITORY = 'REVISION_REPOSITORY';
export const CLAIM_REPOSITORY = 'CLAIM_REPOSITORY';
export const BASELINE_REPOSITORY = 'BASELINE_REPOSITORY';
export const PROPOSAL_REPOSITORY = 'PROPOSAL_REPOSITORY';
export const DISCREPANCY_REPOSITORY = 'DISCREPANCY_REPOSITORY';
export const ACKNOWLEDGEMENT_REPOSITORY = 'ACKNOWLEDGEMENT_REPOSITORY';
export const FACT_EXTRACTOR = 'FACT_EXTRACTOR';

export const buildLake = (db: PrismaClient) => {
  const revisions = new PrismaRevisionRepository(db);
  const claims = new PrismaClaimRepository(db);
  const baseline = new PrismaBaselineRepository(db);
  const proposals = new PrismaProposalRepository(db);
  const discrepancies = new PrismaDiscrepancyRepository(db);
  const acknowledgements = new PrismaAcknowledgementRepository(db);
  const extractor = new FixtureFactExtractor(fixtureCatalog());
  return {
    ports: { revisions, claims, baseline, proposals, discrepancies },
    ingestRevision: new IngestRevision(
      revisions,
      claims,
      baseline,
      proposals,
      discrepancies,
      extractor,
    ),
    openProposal: new OpenProposal(proposals, baseline),
    recordReview: new RecordReview(proposals, baseline),
    reopenProposal: new ReopenProposal(proposals),
    withdrawProposal: new WithdrawProposal(proposals),
    dismissDiscrepancy: new DismissDiscrepancy(discrepancies),
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
    ),
    seedLake: new SeedLake(
      revisions,
      claims,
      baseline,
      proposals,
      discrepancies,
      acknowledgements,
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
    {
      provide: FACT_EXTRACTOR,
      useFactory: () => new FixtureFactExtractor(fixtureCatalog()),
    },
    provideUseCase(IngestRevision, [
      REVISION_REPOSITORY,
      CLAIM_REPOSITORY,
      BASELINE_REPOSITORY,
      PROPOSAL_REPOSITORY,
      DISCREPANCY_REPOSITORY,
      FACT_EXTRACTOR,
    ]),
    provideUseCase(OpenProposal, [PROPOSAL_REPOSITORY, BASELINE_REPOSITORY]),
    provideUseCase(RecordReview, [PROPOSAL_REPOSITORY, BASELINE_REPOSITORY]),
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
    provideUseCase(GetConsensus, [
      REVISION_REPOSITORY,
      CLAIM_REPOSITORY,
      BASELINE_REPOSITORY,
      PROPOSAL_REPOSITORY,
      DISCREPANCY_REPOSITORY,
      ACKNOWLEDGEMENT_REPOSITORY,
    ]),
    provideUseCase(SeedLake, [
      REVISION_REPOSITORY,
      CLAIM_REPOSITORY,
      BASELINE_REPOSITORY,
      PROPOSAL_REPOSITORY,
      DISCREPANCY_REPOSITORY,
      ACKNOWLEDGEMENT_REPOSITORY,
    ]),
  ],
  exports: [
    REVISION_REPOSITORY,
    CLAIM_REPOSITORY,
    BASELINE_REPOSITORY,
    DISCREPANCY_REPOSITORY,
    PROPOSAL_REPOSITORY,
    GetBaseline,
    GetProvenance,
    ListStale,
    ListProposals,
    GetConsensus,
  ],
})
export class LakeModule {}
