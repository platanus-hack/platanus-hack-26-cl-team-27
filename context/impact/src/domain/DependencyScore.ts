import type { AffectedEstimate } from './AffectedSuggestion.ts';
import type { ChangeSummary } from './Evidence.ts';
import { clampProbability } from './Probability.ts';
import {
  findAttribute,
  type ClaimValue,
  type ProjectVocabulary,
} from './Vocabulary.ts';

export interface DependencyScore {
  readonly stakeholderId: string;
  readonly probability: number;
}

export const UNWRITTEN_REASON =
  'Estimación del modelo de decisión, sin razón escrita';

export const NO_EVIDENCE = 'sin evidencia directa';

export const screenScores = (
  scores: readonly DependencyScore[],
  candidateIds: ReadonlySet<string>,
): DependencyScore[] => {
  const best = new Map<string, number>();
  for (const score of scores) {
    if (
      !candidateIds.has(score.stakeholderId) ||
      !Number.isFinite(score.probability)
    ) {
      continue;
    }
    const probability = clampProbability(score.probability);
    if ((best.get(score.stakeholderId) ?? -1) < probability) {
      best.set(score.stakeholderId, probability);
    }
  }
  return [...best].map(([stakeholderId, probability]) => ({
    stakeholderId,
    probability,
  }));
};

const formatValue = (value: ClaimValue, unit: string | null): string => {
  const text =
    typeof value === 'number' ? String(value).replace('.', ',') : String(value);
  return unit ? `${text} ${unit}` : text;
};

export const templateQuestion = (
  change: ChangeSummary,
  vocabulary: ProjectVocabulary,
): string => {
  const subject = vocabulary.subjects.find(
    (candidate) => candidate.id === change.subjectId,
  );
  const attribute = findAttribute(
    vocabulary,
    change.subjectId,
    change.attribute,
  );
  const what =
    subject && attribute
      ? `«${attribute.label}» en «${subject.label}»`
      : `«${change.summary}»`;
  return `¿Te afecta el cambio de ${what}, de ${formatValue(change.before, change.unit)} a ${formatValue(change.after, change.unit)}?`;
};

const hasText = (estimate: AffectedEstimate): boolean =>
  estimate.reason.trim() !== '' && estimate.question.trim() !== '';

export const withScores = (
  scores: readonly DependencyScore[],
  written: readonly AffectedEstimate[],
  fallbackQuestion: string,
): AffectedEstimate[] => {
  const texts = new Map(
    written
      .filter(hasText)
      .map((estimate) => [estimate.stakeholderId, estimate]),
  );
  return scores.map((score) => {
    const text = texts.get(score.stakeholderId);
    return {
      stakeholderId: score.stakeholderId,
      probability: score.probability,
      reason: text?.reason.trim() ?? UNWRITTEN_REASON,
      evidence: text?.evidence.trim() || NO_EVIDENCE,
      question: text?.question.trim() ?? fallbackQuestion,
    };
  });
};
