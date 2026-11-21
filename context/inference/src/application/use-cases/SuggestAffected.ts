import {
  screenEstimates,
  splitByThreshold,
  type AffectedEstimate,
  type AffectedSplit,
} from '../../domain/AffectedSuggestion.ts';
import {
  screenScores,
  templateQuestion,
  withScores,
} from '../../domain/DependencyScore.ts';
import type { ChangeSummary, Evidence } from '../../domain/Evidence.ts';
import { ASK_THRESHOLD, isValidThreshold } from '../../domain/Probability.ts';
import {
  findAttribute,
  type ProjectVocabulary,
} from '../../domain/Vocabulary.ts';
import { InferenceUnavailableError, ValidationError } from '../errors.ts';
import type {
  AffectedEstimator,
  AffectedQuery,
} from '../ports/AffectedEstimator.ts';
import type { DependencyScorer } from '../ports/DependencyScorer.ts';

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
  private readonly scorer: DependencyScorer | null;

  constructor(
    estimator: AffectedEstimator,
    scorer: DependencyScorer | null = null,
  ) {
    this.estimator = estimator;
    this.scorer = scorer;
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
    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    const query: AffectedQuery = {
      change,
      vocabulary,
      candidates,
      evidence: input.evidence,
    };
    const estimates = this.scorer
      ? await this.scoreThenWrite(this.scorer, query, candidateIds, threshold)
      : await this.estimator.estimate(query);
    return splitByThreshold(
      screenEstimates(estimates, candidateIds),
      threshold,
    );
  }

  private async scoreThenWrite(
    scorer: DependencyScorer,
    query: AffectedQuery,
    candidateIds: ReadonlySet<string>,
    threshold: number,
  ): Promise<AffectedEstimate[]> {
    const scores = screenScores(await scorer.score(query), candidateIds);
    const askedIds = new Set(
      scores
        .filter((score) => score.probability >= threshold)
        .map((score) => score.stakeholderId),
    );
    const written =
      askedIds.size === 0
        ? []
        : await this.writeOrSkip({
            ...query,
            candidates: query.candidates.filter((candidate) =>
              askedIds.has(candidate.id),
            ),
          });
    return withScores(
      scores,
      written,
      templateQuestion(query.change, query.vocabulary),
    );
  }

  private async writeOrSkip(query: AffectedQuery): Promise<AffectedEstimate[]> {
    try {
      return await this.estimator.estimate(query);
    } catch (error) {
      if (error instanceof InferenceUnavailableError) return [];
      throw error;
    }
  }
}
