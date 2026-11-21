import {
  screenEstimates,
  splitByThreshold,
  type AffectedSplit,
} from '../../domain/AffectedSuggestion.ts';
import type { ChangeSummary, Evidence } from '../../domain/Evidence.ts';
import { ASK_THRESHOLD, isValidThreshold } from '../../domain/Probability.ts';
import {
  findAttribute,
  type ProjectVocabulary,
} from '../../domain/Vocabulary.ts';
import { ValidationError } from '../errors.ts';
import type { AffectedEstimator } from '../ports/AffectedEstimator.ts';

export interface SuggestAffectedInput {
  readonly change: ChangeSummary;
  readonly vocabulary: ProjectVocabulary;
  readonly notifiedIds: readonly string[];
  readonly authorId: string | null;
  readonly evidence: readonly Evidence[];
  readonly threshold?: number;
}

export class SuggestAffected {
  private readonly estimator: AffectedEstimator;

  constructor(estimator: AffectedEstimator) {
    this.estimator = estimator;
  }

  async execute(input: SuggestAffectedInput): Promise<AffectedSplit> {
    const threshold = input.threshold ?? ASK_THRESHOLD;
    if (!isValidThreshold(threshold)) {
      throw new ValidationError('El umbral debe estar entre 0 y 1');
    }
    const { change, vocabulary } = input;
    if (!findAttribute(vocabulary, change.subjectId, change.attribute)) {
      throw new ValidationError(
        'El cambio no corresponde a un atributo del proyecto',
      );
    }
    const excluded = new Set<string>(input.notifiedIds);
    if (input.authorId) excluded.add(input.authorId);
    const candidates = vocabulary.stakeholders.filter(
      (stakeholder) => !excluded.has(stakeholder.id),
    );
    if (candidates.length === 0) return { ask: [], watch: [] };
    const estimates = await this.estimator.estimate({
      change,
      vocabulary,
      candidates,
      evidence: input.evidence,
    });
    const suggestions = screenEstimates(
      estimates,
      new Set(candidates.map((candidate) => candidate.id)),
    );
    return splitByThreshold(suggestions, threshold);
  }
}
