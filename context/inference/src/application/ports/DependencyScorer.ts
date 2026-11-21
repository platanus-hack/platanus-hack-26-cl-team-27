import type { DependencyScore } from '../../domain/DependencyScore.ts';
import type { AffectedQuery } from './AffectedEstimator.ts';

export interface DependencyScorer {
  score(query: AffectedQuery): Promise<DependencyScore[]>;
}
