import type { Impact } from '../../domain/Impact.ts';
import type { ImpactRepository } from '../ports/ImpactRepository.ts';

export class GetImpacts {
  private readonly impacts: ImpactRepository;

  constructor(impacts: ImpactRepository) {
    this.impacts = impacts;
  }

  execute(changeIds: readonly string[]): Promise<Impact[]> {
    if (changeIds.length === 0) return Promise.resolve([]);
    return this.impacts.findByChangeIds(changeIds);
  }
}
