import { blocksProposal } from '../../domain/Overlap.ts';
import type { Overlap } from '../../domain/Overlap.ts';
import type { Proposal } from '../../domain/Proposal.ts';
import { mergeProposal } from '../mergeProposal.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { OverlapRepository } from '../ports/OverlapRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';
import type { ResolveOverlaps } from './ResolveOverlaps.ts';

const MAX_ROUNDS = 20;

export interface SettledOverlaps {
  readonly resolved: readonly Overlap[];
  readonly merged: readonly Proposal[];
}

export class SettleOverlaps {
  private readonly proposals: ProposalRepository;
  private readonly baseline: BaselineRepository;
  private readonly overlaps: OverlapRepository;
  private readonly resolve: ResolveOverlaps;

  constructor(
    proposals: ProposalRepository,
    baseline: BaselineRepository,
    overlaps: OverlapRepository,
    resolve: ResolveOverlaps,
  ) {
    this.proposals = proposals;
    this.baseline = baseline;
    this.overlaps = overlaps;
    this.resolve = resolve;
  }

  async execute(): Promise<SettledOverlaps> {
    const resolved: Overlap[] = [];
    const merged: Proposal[] = [];
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const justResolved = await this.resolve.execute();
      resolved.push(...justResolved);
      const live = await this.overlaps.listLive();
      const ready = (await this.proposals.listActive()).filter(
        (proposal) =>
          proposal.status === 'open' &&
          proposal.reviews.every((review) => review.decision === 'approve') &&
          !live.some((overlap) => blocksProposal(overlap, proposal.id)),
      );
      const [first] = ready;
      if (!first) {
        if (justResolved.length === 0) break;
        continue;
      }
      const at = new Date();
      const next: Proposal = { ...first, status: 'merged', resolvedAt: at };
      await this.proposals.save(next);
      await mergeProposal(this.baseline, next, at);
      merged.push(next);
    }
    return { resolved, merged };
  }
}
