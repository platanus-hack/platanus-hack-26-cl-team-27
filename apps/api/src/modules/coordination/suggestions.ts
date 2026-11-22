import {
  type AffectedSplit,
  type AffectedSuggestion,
  type ChangeSummary,
  findAttribute,
  InferenceUnavailableError,
  type ProjectVocabulary,
  SuggestAffected,
} from '@team27/context-impact';
import type { Change } from '@team27/context-lake';
import { HttpStatus } from '@nestjs/common';

import { fail } from './http-errors.ts';

export const summariesOf = (
  change: Change,
  vocabulary: ProjectVocabulary,
): ChangeSummary[] =>
  change.diffs
    .filter(
      (diff) =>
        diff.before !== null &&
        diff.after !== null &&
        findAttribute(vocabulary, change.element.id, diff.key) !== null,
    )
    .map((diff) => ({
      subjectId: change.element.id,
      attribute: diff.key,
      before: diff.before ?? '',
      after: diff.after ?? '',
      unit: diff.unit,
      summary: `${change.element.name} · ${diff.label}: ${String(diff.before)} → ${String(diff.after)}`,
    }));

export const mergeSplits = (
  splits: readonly AffectedSplit[],
): AffectedSplit => {
  const best = new Map<string, { item: AffectedSuggestion; ask: boolean }>();
  for (const split of splits) {
    for (const [items, ask] of [
      [split.ask, true],
      [split.watch, false],
    ] as const) {
      for (const item of items) {
        const previous = best.get(item.stakeholderId);
        if (!previous || item.probability > previous.item.probability) {
          best.set(item.stakeholderId, { item, ask });
        }
      }
    }
  }
  const sorted = [...best.values()].sort(
    (a, b) => b.item.probability - a.item.probability,
  );
  return {
    ask: sorted.filter((entry) => entry.ask).map((entry) => entry.item),
    watch: sorted.filter((entry) => !entry.ask).map((entry) => entry.item),
  };
};

export interface SuggestForChangeInput {
  readonly change: Change;
  readonly vocabulary: ProjectVocabulary;
  readonly notifiedIds: readonly string[];
  readonly authorId: string | null;
}

export const suggestForChange = async (
  suggest: SuggestAffected,
  input: SuggestForChangeInput,
): Promise<AffectedSplit> => {
  const summaries = summariesOf(input.change, input.vocabulary);
  try {
    const splits = await Promise.all(
      summaries.map((change) =>
        suggest.execute({
          change,
          vocabulary: input.vocabulary,
          notifiedIds: input.notifiedIds,
          authorId: input.authorId,
          evidence: [],
        }),
      ),
    );
    return mergeSplits(splits);
  } catch (error) {
    if (error instanceof InferenceUnavailableError) {
      throw fail(
        HttpStatus.SERVICE_UNAVAILABLE,
        'inference_unavailable',
        `No pudimos sugerir afectados para el cambio ${input.change.id}: ${error.message}`,
      );
    }
    throw error;
  }
};
