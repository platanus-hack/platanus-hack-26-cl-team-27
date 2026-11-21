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

export interface LakeExclusion {
  readonly documentIds: readonly string[];
  readonly subjectPrefix: string;
}

export const loadLakeState = async (
  repositories: LakeStateRepositories,
  exclusion?: LakeExclusion,
): Promise<LakeState> => {
  const [allRevisions, allClaims, allBaseline, allProposals, allAcks] =
    await Promise.all([
      repositories.revisions.list(),
      repositories.claims.list(),
      repositories.baseline.list(),
      repositories.proposals.list(),
      repositories.acknowledgements.list(),
    ]);
  const excluded = new Set(exclusion?.documentIds ?? []);
  const hiddenRevisions = new Set(
    allRevisions
      .filter((revision) => excluded.has(revision.documentId))
      .map((revision) => revision.id),
  );
  const revisions = allRevisions.filter(
    (revision) => !hiddenRevisions.has(revision.id),
  );
  const claims = allClaims.filter(
    (claim) => !hiddenRevisions.has(claim.revisionId),
  );
  const baseline = exclusion
    ? allBaseline.filter(
        (entry) => !entry.subject.startsWith(exclusion.subjectPrefix),
      )
    : allBaseline;
  const proposals = allProposals.filter(
    (proposal) => !excluded.has(proposal.documentId),
  );
  const acknowledgements = allAcks.filter(
    (ack) => !excluded.has(ack.documentId),
  );
  const stale = computeStaleness({
    revisions,
    claims,
    baseline,
    proposals,
    acknowledgements,
  });
  return { revisions, claims, baseline, proposals, stale };
};
