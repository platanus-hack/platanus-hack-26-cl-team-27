import { isActive } from '../../domain/Proposal.ts';
import type { Proposal } from '../../domain/Proposal.ts';
import { ValidationError } from '../errors.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';

export interface WithdrawProposalInput {
  readonly proposalId: string;
  readonly actorId?: string;
}

export class WithdrawProposal {
  private readonly proposals: ProposalRepository;

  constructor(proposals: ProposalRepository) {
    this.proposals = proposals;
  }

  async execute(input: WithdrawProposalInput): Promise<Proposal> {
    const proposal = await this.proposals.findById(input.proposalId);
    if (!proposal) throw new ValidationError('La propuesta no existe');
    if (input.actorId !== undefined && input.actorId !== proposal.authorId) {
      throw new ValidationError('Solo el autor puede retirar la propuesta');
    }
    if (proposal.status === 'withdrawn') return proposal;
    if (!isActive(proposal)) {
      throw new ValidationError('La propuesta ya no está abierta');
    }
    const next: Proposal = {
      ...proposal,
      status: 'withdrawn',
      resolvedAt: new Date(),
    };
    await this.proposals.save(next);
    return next;
  }
}
