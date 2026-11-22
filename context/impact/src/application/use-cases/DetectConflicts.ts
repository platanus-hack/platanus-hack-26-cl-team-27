import {
  screenConflicts,
  splitConflicts,
  type ChangeBrief,
  type ConflictSplit,
} from '../../domain/ConflictSuggestion.ts';
import { ASK_THRESHOLD, isValidThreshold } from '../../domain/Probability.ts';
import type { ProjectVocabulary } from '../../domain/Vocabulary.ts';
import { ValidationError } from '../errors.ts';
import type { ConflictEstimator } from '../ports/ConflictEstimator.ts';

export interface DetectConflictsInput {
  readonly change: ChangeBrief;
  readonly others: readonly ChangeBrief[];
  readonly vocabulary: ProjectVocabulary;
  readonly threshold?: number;
}

export class DetectConflicts {
  private readonly estimator: ConflictEstimator;

  constructor(estimator: ConflictEstimator) {
    this.estimator = estimator;
  }

  async execute(input: DetectConflictsInput): Promise<ConflictSplit> {
    const threshold = input.threshold ?? ASK_THRESHOLD;
    if (!isValidThreshold(threshold)) {
      throw new ValidationError('El umbral debe estar entre 0 y 1');
    }
    const others = input.others.filter((other) => other.id !== input.change.id);
    if (others.length === 0) return { conflicts: [], watch: [] };
    const estimates = await this.estimator.estimate({
      change: input.change,
      others,
      vocabulary: input.vocabulary,
    });
    return splitConflicts(
      screenConflicts(estimates, new Set(others.map((other) => other.id))),
      threshold,
    );
  }
}
