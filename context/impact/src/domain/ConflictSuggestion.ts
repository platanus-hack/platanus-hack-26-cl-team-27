import {
  clampProbability,
  probabilityBand,
  type ProbabilityBand,
} from './Probability.ts';

export interface ChangeBrief {
  readonly id: string;
  readonly subjectId: string;
  readonly summary: string;
  readonly detectedAt: string;
}

export interface ConflictEstimate {
  readonly otherChangeId: string;
  readonly probability: number;
  readonly reason: string;
  readonly question: string;
}

export interface ConflictSuggestion extends ConflictEstimate {
  readonly band: ProbabilityBand;
}

export interface ConflictSplit {
  readonly conflicts: ConflictSuggestion[];
  readonly watch: ConflictSuggestion[];
}

const isUsable = (estimate: ConflictEstimate): boolean =>
  Number.isFinite(estimate.probability) &&
  estimate.reason.trim() !== '' &&
  estimate.question.trim() !== '';

export const screenConflicts = (
  estimates: readonly ConflictEstimate[],
  candidateIds: ReadonlySet<string>,
): ConflictSuggestion[] => {
  const best = new Map<string, ConflictEstimate>();
  for (const estimate of estimates) {
    if (!candidateIds.has(estimate.otherChangeId) || !isUsable(estimate)) {
      continue;
    }
    const probability = clampProbability(estimate.probability);
    const previous = best.get(estimate.otherChangeId);
    if (previous && previous.probability >= probability) continue;
    best.set(estimate.otherChangeId, {
      otherChangeId: estimate.otherChangeId,
      probability,
      reason: estimate.reason.trim(),
      question: estimate.question.trim(),
    });
  }
  return [...best.values()]
    .map((estimate) => ({
      ...estimate,
      band: probabilityBand(estimate.probability),
    }))
    .sort(
      (a, b) =>
        b.probability - a.probability ||
        a.otherChangeId.localeCompare(b.otherChangeId),
    );
};

export const splitConflicts = (
  suggestions: readonly ConflictSuggestion[],
  threshold: number,
): ConflictSplit => ({
  conflicts: suggestions.filter((item) => item.probability >= threshold),
  watch: suggestions.filter((item) => item.probability < threshold),
});
