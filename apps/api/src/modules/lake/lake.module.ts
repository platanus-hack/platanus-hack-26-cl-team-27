import { Module } from '@nestjs/common';
import {
  AcknowledgeStale,
  ClearScope,
  DetectChanges,
  DismissDiscrepancy,
  EnsureBaseline,
  type FactExtractor,
  GetBaseline,
  GetChange,
  GetConsensus,
  GetProvenance,
  IngestRevision,
  ListChanges,
  ListOverlaps,
  ListProposals,
  ListStale,
  OpenOverlaps,
  OpenProposal,
  RecordReview,
  RecordRevision,
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
  PrismaChangeRepository,
  PrismaChunkRepository,
  PrismaClaimRepository,
  PrismaDiscrepancyRepository,
  PrismaOverlapRepository,
  PrismaProposalRepository,
  PrismaRevisionRepository,
} from '@team27/context-lake/adapters';
import type { PrismaClient } from '@team27/data-main';

import { provideUseCase } from '../../common/provide-use-case.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import type { ProjectCatalog } from '../project/project-catalog.ts';
import { PROJECT_CATALOG } from '../project/project.module.ts';

export const REVISION_REPOSITORY = 'REVISION_REPOSITORY';
export const CHUNK_REPOSITORY = 'CHUNK_REPOSITORY';
export const CLAIM_REPOSITORY = 'CLAIM_REPOSITORY';
export const OVERLAP_REPOSITORY = 'OVERLAP_REPOSITORY';
export const BASELINE_REPOSITORY = 'BASELINE_REPOSITORY';
export const PROPOSAL_REPOSITORY = 'PROPOSAL_REPOSITORY';
export const DISCREPANCY_REPOSITORY = 'DISCREPANCY_REPOSITORY';
export const ACKNOWLEDGEMENT_REPOSITORY = 'ACKNOWLEDGEMENT_REPOSITORY';
export const CHANGE_REPOSITORY = 'CHANGE_REPOSITORY';

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
    openProposal: new OpenProposal(proposals, baseline),
    recordRevision: new RecordRevision(revisions, chunks, claims),
    ensureBaseline: new EnsureBaseline(revisions, chunks, claims, baseline),
    clearScope: new ClearScope(revisions, proposals, baseline),
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
      inject: [PRISMA_CLIENT, PROJECT_CATALOG],
      useFactory: (prisma: PrismaClient, project: ProjectCatalog) =>
        new PrismaRevisionRepository(prisma, project.id),
    },
    {
      provide: CHUNK_REPOSITORY,
      inject: [PRISMA_CLIENT, PROJECT_CATALOG],
      useFactory: (prisma: PrismaClient, project: ProjectCatalog) =>
        new PrismaChunkRepository(prisma, project.id),
    },
    {
      provide: OVERLAP_REPOSITORY,
      inject: [PRISMA_CLIENT, PROJECT_CATALOG],
      useFactory: (prisma: PrismaClient, project: ProjectCatalog) =>
        new PrismaOverlapRepository(prisma, project.id),
    },
    {
      provide: CLAIM_REPOSITORY,
      inject: [PRISMA_CLIENT, PROJECT_CATALOG],
      useFactory: (prisma: PrismaClient, project: ProjectCatalog) =>
        new PrismaClaimRepository(prisma, project.id),
    },
    {
      provide: BASELINE_REPOSITORY,
      inject: [PRISMA_CLIENT, PROJECT_CATALOG],
      useFactory: (prisma: PrismaClient, project: ProjectCatalog) =>
        new PrismaBaselineRepository(prisma, project.id),
    },
    {
      provide: PROPOSAL_REPOSITORY,
      inject: [PRISMA_CLIENT, PROJECT_CATALOG],
      useFactory: (prisma: PrismaClient, project: ProjectCatalog) =>
        new PrismaProposalRepository(prisma, project.id),
    },
    {
      provide: DISCREPANCY_REPOSITORY,
      inject: [PRISMA_CLIENT, PROJECT_CATALOG],
      useFactory: (prisma: PrismaClient, project: ProjectCatalog) =>
        new PrismaDiscrepancyRepository(prisma, project.id),
    },
    {
      provide: ACKNOWLEDGEMENT_REPOSITORY,
      inject: [PRISMA_CLIENT, PROJECT_CATALOG],
      useFactory: (prisma: PrismaClient, project: ProjectCatalog) =>
        new PrismaAcknowledgementRepository(prisma, project.id),
    },
    {
      provide: CHANGE_REPOSITORY,
      inject: [PRISMA_CLIENT, PROJECT_CATALOG],
      useFactory: (prisma: PrismaClient, project: ProjectCatalog) =>
        new PrismaChangeRepository(prisma, project.id),
    },
    provideUseCase(DetectChanges, [CHANGE_REPOSITORY]),
    provideUseCase(ListChanges, [CHANGE_REPOSITORY]),
    provideUseCase(GetChange, [CHANGE_REPOSITORY]),
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
    DetectChanges,
    ListChanges,
    GetChange,
    GetBaseline,
    GetProvenance,
    ListStale,
    ListProposals,
    ListOverlaps,
    GetConsensus,
  ],
})
export class LakeModule {}
