import type { Impact } from '../../domain/Impact.ts';

export interface ImpactRepository {
  save(impact: Impact): Promise<void>;
  findByChangeIds(changeIds: readonly string[]): Promise<Impact[]>;
}
