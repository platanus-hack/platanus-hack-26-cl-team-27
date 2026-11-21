import { baselineKey } from './Baseline.ts';
import type { BaselineEntry } from './Baseline.ts';
import type { ClaimOutcome } from './classifyClaims.ts';
import type { ClaimValue } from './Claim.ts';
import type { ProposalChange, ProposalDraft } from './Proposal.ts';

export interface DraftSource {
  readonly revisionId: string;
  readonly authorId: string;
}

export const groupBySubject = (
  outcomes: readonly ClaimOutcome[],
  baseline: readonly BaselineEntry[],
  source: DraftSource,
): ProposalDraft[] => {
  const changes = new Map<string, Map<string, ProposalChange>>();
  for (const outcome of outcomes) {
    if (outcome.kind !== 'change' || outcome.baselineValue === null) continue;
    const { claim } = outcome;
    const bySubject =
      changes.get(claim.subject) ?? new Map<string, ProposalChange>();
    bySubject.set(claim.attribute, {
      attribute: claim.attribute,
      unit: claim.unit,
      before: outcome.baselineValue,
      after: claim.value,
      claimId: claim.id,
    });
    changes.set(claim.subject, bySubject);
  }

  const byKey = new Map(
    baseline.map((entry) => [
      baselineKey(entry.subject, entry.attribute),
      entry,
    ]),
  );
  return [...changes.entries()].map(([subject, subjectChanges]) => {
    const before: Record<string, ClaimValue> = {};
    for (const entry of byKey.values()) {
      if (entry.subject === subject) before[entry.attribute] = entry.value;
    }
    const list = [...subjectChanges.values()];
    const after: Record<string, ClaimValue> = { ...before };
    for (const change of list) after[change.attribute] = change.after;
    return {
      subject,
      sourceRevisionId: source.revisionId,
      authorId: source.authorId,
      changes: list,
      before,
      after,
    };
  });
};
