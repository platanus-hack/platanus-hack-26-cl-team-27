import { reopenFor } from '../../domain/Proposal.ts';
import type { Proposal } from '../../domain/Proposal.ts';
import { ValidationError } from '../errors.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';

export interface ReopenProposalInput {
  readonly proposalId: string;
  readonly actorId?: string;
}

export interface ReopenedProposal {
  readonly proposal: Proposal;
  readonly reopenedReviewerIds: readonly string[];
}

export class ReopenProposal {
  private readonly proposals: ProposalRepository;

  constructor(proposals: ProposalRepository) {
    this.proposals = proposals;
  }

  async execute(input: ReopenProposalInput): Promise<ReopenedProposal> {
    const proposal = await this.proposals.findById(input.proposalId);
    if (!proposal) throw new ValidationError('La propuesta no existe');
    if (input.actorId !== undefined && input.actorId !== proposal.authorId) {
      throw new ValidationError('Solo el autor puede reabrir la propuesta');
    }
    if (proposal.status !== 'disputed') {
      throw new ValidationError('Solo se reabre una propuesta en disputa');
    }
    const { proposal: next, reopened } = reopenFor(proposal);
    await this.proposals.save(next);
    return { proposal: next, reopenedReviewerIds: reopened };
  }
}
