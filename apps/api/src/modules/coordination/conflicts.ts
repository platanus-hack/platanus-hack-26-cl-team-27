import {
  type ChangeBrief,
  type ConflictSplit,
  DetectConflicts,
  InferenceUnavailableError,
  type ProjectVocabulary,
} from '@team27/context-impact';
import {
  type Change,
  isLiveOverlap,
  type Overlap,
  type Proposal,
} from '@team27/context-lake';

export const CONFLICT_WINDOW = 20;

export const briefOf = (change: Change): ChangeBrief => ({
  id: change.id,
  subjectId: change.element.id,
  summary: [
    `${change.element.name} (${change.kind})`,
    ...change.diffs.map(
      (diff) =>
        `${diff.label}: ${String(diff.before ?? '—')} → ${String(diff.after ?? '—')}${diff.unit ? ` ${diff.unit}` : ''}`,
    ),
  ].join(' · '),
  detectedAt: change.detectedAt.toISOString(),
});

export const liveOverlapsOf = (
  overlaps: readonly Overlap[],
  change: Change,
  proposalId: string | null,
): Overlap[] =>
  overlaps.filter(
    (overlap) =>
      isLiveOverlap(overlap) &&
      proposalId !== null &&
      (overlap.proposalId === proposalId ||
        overlap.otherProposalId === proposalId) &&
      (overlap.subjectId === change.element.id ||
        overlap.otherSubjectId === change.element.id),
  );

export const comparableChanges = (
  changes: readonly Change[],
  proposals: readonly Pick<Proposal, 'status' | 'changeIds'>[],
): Change[] => {
  const dropped = new Set(
    proposals
      .filter(
        (proposal) =>
          proposal.status === 'superseded' || proposal.status === 'withdrawn',
      )
      .flatMap((proposal) => proposal.changeIds),
  );
  return changes.filter((change) => !dropped.has(change.id));
};

export interface DetectForChangeInput {
  readonly change: Change;
  readonly others: readonly Change[];
  readonly vocabulary: ProjectVocabulary;
}

export interface DetectForChangeResult extends ConflictSplit {
  readonly inference: 'ok' | 'unavailable';
  readonly inferenceMessage: string | null;
}

export const detectForChange = async (
  detect: DetectConflicts,
  input: DetectForChangeInput,
): Promise<DetectForChangeResult> => {
  const others = input.others
    .filter((other) => other.id !== input.change.id)
    .slice(0, CONFLICT_WINDOW);
  try {
    const split = await detect.execute({
      change: briefOf(input.change),
      others: others.map(briefOf),
      vocabulary: input.vocabulary,
    });
    return { ...split, inference: 'ok', inferenceMessage: null };
  } catch (error) {
    if (error instanceof InferenceUnavailableError) {
      return {
        conflicts: [],
        watch: [],
        inference: 'unavailable',
        inferenceMessage: error.message,
      };
    }
    throw error;
  }
};
