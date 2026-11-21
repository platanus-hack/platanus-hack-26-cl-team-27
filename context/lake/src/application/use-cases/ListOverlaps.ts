import { isLiveOverlap } from '../../domain/Overlap.ts';
import type { Overlap, OverlapStatus } from '../../domain/Overlap.ts';
import type { OverlapRepository } from '../ports/OverlapRepository.ts';

export interface ListOverlapsInput {
  readonly status?: OverlapStatus | 'activo';
}

export class ListOverlaps {
  private readonly overlaps: OverlapRepository;

  constructor(overlaps: OverlapRepository) {
    this.overlaps = overlaps;
  }

  async execute(input: ListOverlapsInput = {}): Promise<Overlap[]> {
    const all = await this.overlaps.list();
    if (input.status === undefined) return all;
    if (input.status === 'activo') return all.filter(isLiveOverlap);
    return all.filter((overlap) => overlap.status === input.status);
  }
}
