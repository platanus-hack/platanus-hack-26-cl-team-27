import {
  clampProbability,
  probabilityBand,
  type ProbabilityBand,
} from './Probability.ts';

export interface AffectedEstimate {
  readonly stakeholderId: string;
  readonly probability: number;
  readonly reason: string;
  readonly evidence: string;
  readonly question: string;
}

export interface AffectedSuggestion extends AffectedEstimate {
  readonly band: ProbabilityBand;
}

export interface AffectedSplit {
  readonly ask: AffectedSuggestion[];
  readonly watch: AffectedSuggestion[];
}

const isUsable = (estimate: AffectedEstimate): boolean =>
  Number.isFinite(estimate.probability) &&
  estimate.reason.trim() !== '' &&
  estimate.question.trim() !== '';

export const screenEstimates = (
  estimates: readonly AffectedEstimate[],
  candidateIds: ReadonlySet<string>,
): AffectedSuggestion[] => {
  const best = new Map<string, AffectedEstimate>();
  for (const estimate of estimates) {
    if (!candidateIds.has(estimate.stakeholderId) || !isUsable(estimate)) {
      continue;
    }
    const probability = clampProbability(estimate.probability);
    const previous = best.get(estimate.stakeholderId);
    if (previous && previous.probability >= probability) continue;
    best.set(estimate.stakeholderId, {
      stakeholderId: estimate.stakeholderId,
      probability,
      reason: estimate.reason.trim(),
      evidence: estimate.evidence.trim(),
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
        a.stakeholderId.localeCompare(b.stakeholderId),
    );
};

export const splitByThreshold = (
  suggestions: readonly AffectedSuggestion[],
  threshold: number,
): AffectedSplit => ({
  ask: suggestions.filter((suggestion) => suggestion.probability >= threshold),
  watch: suggestions.filter((suggestion) => suggestion.probability < threshold),
});
