import type { Proposal, ProposalStatus } from '../../domain/Proposal.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';

export interface ListProposalsInput {
  readonly status?: ProposalStatus | 'active';
}

export class ListProposals {
  private readonly proposals: ProposalRepository;

  constructor(proposals: ProposalRepository) {
    this.proposals = proposals;
  }

  async execute(input: ListProposalsInput = {}): Promise<Proposal[]> {
    if (input.status === 'active') return this.proposals.listActive();
    return this.proposals.list(input.status);
  }
}
