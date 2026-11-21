import type { BaselineEntry } from '../domain/Baseline.ts';
import type { Claim } from '../domain/Claim.ts';
import { computeStaleness } from '../domain/computeStaleness.ts';
import type { StaleDocument } from '../domain/computeStaleness.ts';
import type { Proposal } from '../domain/Proposal.ts';
import type { Revision } from '../domain/Revision.ts';
import type { AcknowledgementRepository } from './ports/AcknowledgementRepository.ts';
import type { BaselineRepository } from './ports/BaselineRepository.ts';
import type { ClaimRepository } from './ports/ClaimRepository.ts';
import type { ProposalRepository } from './ports/ProposalRepository.ts';
import type { RevisionRepository } from './ports/RevisionRepository.ts';

export interface LakeStateRepositories {
  readonly revisions: RevisionRepository;
  readonly claims: ClaimRepository;
  readonly baseline: BaselineRepository;
  readonly proposals: ProposalRepository;
  readonly acknowledgements: AcknowledgementRepository;
}

export interface LakeState {
  readonly revisions: Revision[];
  readonly claims: Claim[];
  readonly baseline: BaselineEntry[];
  readonly proposals: Proposal[];
  readonly stale: StaleDocument[];
}

export const loadLakeState = async (
  repositories: LakeStateRepositories,
): Promise<LakeState> => {
  const [revisions, claims, baseline, proposals, acknowledgements] =
    await Promise.all([
      repositories.revisions.list(),
      repositories.claims.list(),
      repositories.baseline.list(),
      repositories.proposals.list(),
      repositories.acknowledgements.list(),
    ]);
  const stale = computeStaleness({
    revisions,
    claims,
    baseline,
    proposals,
    acknowledgements,
  });
  return { revisions, claims, baseline, proposals, stale };
};
