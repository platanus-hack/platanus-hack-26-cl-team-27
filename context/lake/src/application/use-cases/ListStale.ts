import type { StaleDocument } from '../../domain/computeStaleness.ts';
import { loadLakeState } from '../loadLakeState.ts';
import type { AcknowledgementRepository } from '../ports/AcknowledgementRepository.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { ClaimRepository } from '../ports/ClaimRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';
import type { RevisionRepository } from '../ports/RevisionRepository.ts';

export class ListStale {
  private readonly revisions: RevisionRepository;
  private readonly claims: ClaimRepository;
  private readonly baseline: BaselineRepository;
  private readonly proposals: ProposalRepository;
  private readonly acknowledgements: AcknowledgementRepository;

  constructor(
    revisions: RevisionRepository,
    claims: ClaimRepository,
    baseline: BaselineRepository,
    proposals: ProposalRepository,
    acknowledgements: AcknowledgementRepository,
  ) {
    this.revisions = revisions;
    this.claims = claims;
    this.baseline = baseline;
    this.proposals = proposals;
    this.acknowledgements = acknowledgements;
  }

  async execute(): Promise<StaleDocument[]> {
    return (
      await loadLakeState({
        revisions: this.revisions,
        claims: this.claims,
        baseline: this.baseline,
        proposals: this.proposals,
        acknowledgements: this.acknowledgements,
      })
    ).stale;
  }
}
