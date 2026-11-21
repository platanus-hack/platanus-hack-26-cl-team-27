import { consensusIndex } from '../../domain/consensusIndex.ts';
import type { ConsensusIndex } from '../../domain/consensusIndex.ts';
import type { StaleDocument } from '../../domain/computeStaleness.ts';
import type { Discrepancy } from '../../domain/Discrepancy.ts';
import { isActive } from '../../domain/Proposal.ts';
import type { Proposal } from '../../domain/Proposal.ts';
import { loadLakeState } from '../loadLakeState.ts';
import type { AcknowledgementRepository } from '../ports/AcknowledgementRepository.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { ClaimRepository } from '../ports/ClaimRepository.ts';
import type { DiscrepancyRepository } from '../ports/DiscrepancyRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';
import type { RevisionRepository } from '../ports/RevisionRepository.ts';

export interface Consensus {
  readonly index: ConsensusIndex;
  readonly openProposals: readonly Proposal[];
  readonly mergedProposals: readonly Proposal[];
  readonly openDiscrepancies: readonly Discrepancy[];
  readonly stale: readonly StaleDocument[];
}

export class GetConsensus {
  private readonly revisions: RevisionRepository;
  private readonly claims: ClaimRepository;
  private readonly baseline: BaselineRepository;
  private readonly proposals: ProposalRepository;
  private readonly discrepancies: DiscrepancyRepository;
  private readonly acknowledgements: AcknowledgementRepository;

  constructor(
    revisions: RevisionRepository,
    claims: ClaimRepository,
    baseline: BaselineRepository,
    proposals: ProposalRepository,
    discrepancies: DiscrepancyRepository,
    acknowledgements: AcknowledgementRepository,
  ) {
    this.revisions = revisions;
    this.claims = claims;
    this.baseline = baseline;
    this.proposals = proposals;
    this.discrepancies = discrepancies;
    this.acknowledgements = acknowledgements;
  }

  async execute(): Promise<Consensus> {
    const state = await loadLakeState(this);
    const discrepancies = await this.discrepancies.list();
    const index = consensusIndex({
      revisions: state.revisions,
      stale: state.stale,
      discrepancies,
      proposals: state.proposals,
    });
    return {
      index,
      openProposals: state.proposals.filter(isActive),
      mergedProposals: state.proposals.filter((p) => p.status === 'merged'),
      openDiscrepancies: discrepancies.filter((d) => d.status === 'open'),
      stale: state.stale,
    };
  }
}
