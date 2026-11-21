import type { FootprintModel } from '../../domain/AreaCell.ts';
import { reassessOverlaps } from '../../domain/detectOverlaps.ts';
import type { Overlap } from '../../domain/Overlap.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { OverlapRepository } from '../ports/OverlapRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';

export class ResolveOverlaps {
  private readonly baseline: BaselineRepository;
  private readonly proposals: ProposalRepository;
  private readonly overlaps: OverlapRepository;
  private readonly footprint: FootprintModel;

  constructor(
    baseline: BaselineRepository,
    proposals: ProposalRepository,
    overlaps: OverlapRepository,
    footprint: FootprintModel,
  ) {
    this.baseline = baseline;
    this.proposals = proposals;
    this.overlaps = overlaps;
    this.footprint = footprint;
  }

  async execute(): Promise<Overlap[]> {
    const [baseline, proposals, live] = await Promise.all([
      this.baseline.list(),
      this.proposals.list(),
      this.overlaps.listLive(),
    ]);
    const items = reassessOverlaps(live, {
      baseline,
      proposals,
      footprint: this.footprint,
    });
    const resolvedAt = new Date();
    const resolved: Overlap[] = [];
    for (const item of items) {
      const overlap = live.find((candidate) => candidate.id === item.overlapId);
      if (!overlap) continue;
      const next: Overlap = {
        ...overlap,
        status: 'resuelto',
        resolution: item.resolution,
        resolvedAt,
      };
      await this.overlaps.save(next);
      resolved.push(next);
    }
    return resolved;
  }
}
