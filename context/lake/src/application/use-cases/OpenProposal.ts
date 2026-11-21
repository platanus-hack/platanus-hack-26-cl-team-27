import { isActive } from '../../domain/Proposal.ts';
import type {
  FilteredReviewer,
  Proposal,
  ProposalDraft,
} from '../../domain/Proposal.ts';
import { ValidationError } from '../errors.ts';
import { mergeProposal } from '../mergeProposal.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';

export interface OpenProposalInput {
  readonly draft: ProposalDraft;
  readonly changeId: string | null;
  readonly changeIds?: readonly string[];
  readonly deferMerge?: boolean;
  readonly reviewerIds: readonly string[];
  readonly filtered: readonly FilteredReviewer[];
}

export interface OpenedProposal {
  readonly proposal: Proposal;
  readonly superseded: readonly Proposal[];
}

export class OpenProposal {
  private readonly proposals: ProposalRepository;
  private readonly baseline: BaselineRepository;

  constructor(proposals: ProposalRepository, baseline: BaselineRepository) {
    this.proposals = proposals;
    this.baseline = baseline;
  }

  async execute(input: OpenProposalInput): Promise<OpenedProposal> {
    const { draft } = input;
    if (draft.changes.length === 0) {
      throw new ValidationError('La propuesta no cambia nada');
    }
    if (new Set(input.reviewerIds).size !== input.reviewerIds.length) {
      throw new ValidationError('Los revisores no pueden repetirse');
    }

    const overlapping = (await this.proposals.listActive()).filter(
      (proposal) =>
        isActive(proposal) && proposal.documentId === draft.documentId,
    );

    const openedAt = new Date();
    let proposal = await this.proposals.create({
      changeId: input.changeId,
      changeIds: input.changeIds ?? (input.changeId ? [input.changeId] : []),
      documentId: draft.documentId,
      sourceRevisionId: draft.sourceRevisionId,
      authorId: draft.authorId,
      changes: draft.changes,
      context: draft.context,
      reviewerIds: input.reviewerIds,
      filtered: input.filtered,
      openedAt,
    });

    const superseded: Proposal[] = [];
    for (const old of overlapping) {
      const next: Proposal = {
        ...old,
        status: 'superseded',
        resolvedAt: openedAt,
        supersededById: proposal.id,
      };
      await this.proposals.save(next);
      superseded.push(next);
    }

    if (input.reviewerIds.length === 0 && !input.deferMerge) {
      proposal = { ...proposal, status: 'merged', resolvedAt: openedAt };
      await this.proposals.save(proposal);
      await mergeProposal(this.baseline, proposal, openedAt);
    }
    return { proposal, superseded };
  }
}
