import {
  applyReview,
  decideProposal,
  isActive,
} from '../../domain/Proposal.ts';
import { blocksProposal } from '../../domain/Overlap.ts';
import type { Decision, Proposal } from '../../domain/Proposal.ts';
import { ValidationError } from '../errors.ts';
import { mergeProposal } from '../mergeProposal.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { OverlapRepository } from '../ports/OverlapRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';

export interface RecordReviewInput {
  readonly proposalId: string;
  readonly reviewerId: string;
  readonly decision: Decision;
  readonly note?: string | null;
}

export interface RecordedReview {
  readonly proposal: Proposal;
  readonly changed: boolean;
  readonly merged: boolean;
}

export class RecordReview {
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

  async execute(input: RecordReviewInput): Promise<RecordedReview> {
    const proposal = await this.proposals.findById(input.proposalId);
    if (!proposal) throw new ValidationError('La propuesta no existe');
    const review = proposal.reviews.find(
      (candidate) => candidate.reviewerId === input.reviewerId,
    );
    if (!review) {
      throw new ValidationError('Quien responde no es revisor de la propuesta');
    }
    if (review.decision === input.decision) {
      return { proposal, changed: false, merged: false };
    }
    if (review.decision !== null) {
      throw new ValidationError('El revisor ya respondió esta propuesta');
    }
    if (!isActive(proposal)) {
      throw new ValidationError('La propuesta ya no admite respuestas');
    }

    const at = new Date();
    const voted = applyReview(
      proposal,
      input.reviewerId,
      input.decision,
      input.note?.trim() || null,
      at,
    );
    const decided = decideProposal(voted);
    const blocked =
      decided === 'merged' &&
      (await this.overlaps.listLive()).some((overlap) =>
        blocksProposal(overlap, proposal.id),
      );
    const status = blocked ? 'open' : decided;
    const next: Proposal = {
      ...voted,
      status,
      resolvedAt: status === 'merged' ? at : null,
    };
    await this.proposals.save(next);
    if (status === 'merged') await mergeProposal(this.baseline, next, at);
    return { proposal: next, changed: true, merged: status === 'merged' };
  }
}
