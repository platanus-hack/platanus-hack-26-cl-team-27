import { blocksProposal } from '../../domain/Overlap.ts';
import {
  decideProposal,
  excuseReviewer,
  isActive,
  NOT_AFFECTED_REASON,
} from '../../domain/Proposal.ts';
import type { Proposal } from '../../domain/Proposal.ts';
import { ValidationError } from '../errors.ts';
import { mergeProposal } from '../mergeProposal.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { OverlapRepository } from '../ports/OverlapRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';

export interface ExcuseReviewerInput {
  readonly proposalId: string;
  readonly reviewerId: string;
  readonly reason?: string | null;
}

export interface ExcusedReviewer {
  readonly proposal: Proposal;
  readonly changed: boolean;
  readonly merged: boolean;
}

export class ExcuseReviewer {
  private readonly proposals: ProposalRepository;
  private readonly baseline: BaselineRepository;
  private readonly overlaps: OverlapRepository;

  constructor(
    proposals: ProposalRepository,
    baseline: BaselineRepository,
    overlaps: OverlapRepository,
  ) {
    this.proposals = proposals;
    this.baseline = baseline;
    this.overlaps = overlaps;
  }

  async execute(input: ExcuseReviewerInput): Promise<ExcusedReviewer> {
    const proposal = await this.proposals.findById(input.proposalId);
    if (!proposal) throw new ValidationError('La propuesta no existe');
    if (
      proposal.filtered.some(
        (person) => person.id === input.reviewerId && person.notAffected,
      )
    ) {
      return { proposal, changed: false, merged: false };
    }
    const review = proposal.reviews.find(
      (candidate) => candidate.reviewerId === input.reviewerId,
    );
    if (!review) {
      throw new ValidationError('Quien responde no es revisor de la propuesta');
    }
    if (review.decision !== null) {
      throw new ValidationError('El revisor ya respondió esta propuesta');
    }
    if (!isActive(proposal)) {
      throw new ValidationError('La propuesta ya no admite respuestas');
    }

    const at = new Date();
    const excused = excuseReviewer(
      proposal,
      input.reviewerId,
      input.reason?.trim() || NOT_AFFECTED_REASON,
    );
    const decided = decideProposal(excused);
    const blocked =
      decided === 'merged' &&
      (await this.overlaps.listLive()).some((overlap) =>
        blocksProposal(overlap, proposal.id),
      );
    const status = blocked ? 'open' : decided;
    const next: Proposal = {
      ...excused,
      status,
      resolvedAt: status === 'merged' ? at : null,
    };
    await this.proposals.save(next);
    if (status === 'merged') await mergeProposal(this.baseline, next, at);
    return { proposal: next, changed: true, merged: status === 'merged' };
  }
}
