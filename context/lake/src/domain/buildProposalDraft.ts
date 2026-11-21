import { baselineKey } from './Baseline.ts';
import type { BaselineEntry } from './Baseline.ts';
import type { ClaimOutcome } from './classifyClaims.ts';
import type {
  ProposalChange,
  ProposalContext,
  ProposalDraft,
  SubjectValues,
} from './Proposal.ts';

export interface DraftSource {
  readonly documentId: string;
  readonly revisionId: string;
  readonly authorId: string;
}

export const buildProposalDraft = (
  outcomes: readonly ClaimOutcome[],
  baseline: readonly BaselineEntry[],
  source: DraftSource,
): ProposalDraft | null => {
  const changes: ProposalChange[] = [];
  const context: ProposalContext[] = [];
  for (const outcome of outcomes) {
    const { claim } = outcome;
    if (outcome.kind === 'change' && outcome.baselineValue !== null) {
      changes.push({
        subject: claim.subject,
        attribute: claim.attribute,
        unit: claim.unit,
        before: outcome.baselineValue,
        after: claim.value,
        claimId: claim.id,
        locator: claim.locator,
      });
    } else if (
      claim.role === 'afirma' &&
      (outcome.kind === 'same' || outcome.kind === 'corroborates')
    ) {
      context.push({
        subject: claim.subject,
        attribute: claim.attribute,
        value: claim.value,
        unit: claim.unit,
        locator: claim.locator,
      });
    }
  }
  if (changes.length === 0) return null;

  const subjects = new Set(changes.map((change) => change.subject));
  const byKey = new Map(
    baseline.map((entry) => [
      baselineKey(entry.subject, entry.attribute),
      entry,
    ]),
  );
  const before: Record<string, Record<string, SubjectValues[string]>> = {};
  const after: Record<string, Record<string, SubjectValues[string]>> = {};
  for (const subject of subjects) {
    before[subject] = {};
    after[subject] = {};
  }
  for (const entry of byKey.values()) {
    if (!subjects.has(entry.subject)) continue;
    before[entry.subject]![entry.attribute] = entry.value;
    after[entry.subject]![entry.attribute] = entry.value;
  }
  for (const change of changes) {
    after[change.subject]![change.attribute] = change.after;
  }
  return {
    documentId: source.documentId,
    sourceRevisionId: source.revisionId,
    authorId: source.authorId,
    changes,
    context,
    before,
    after,
  };
};
