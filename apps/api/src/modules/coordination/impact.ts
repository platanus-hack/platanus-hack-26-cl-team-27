import {
  type ChangeUnderAnalysis,
  type CombinedImpact,
  combineImpacts,
  type Impact,
  type ProjectGraph,
  ruleCoverage,
  ruleGapMessage,
} from '@team27/context-impact';
import type { Change } from '@team27/context-lake';

export const underAnalysisOf = (change: Change): ChangeUnderAnalysis => ({
  id: change.id,
  elementId: change.element.id,
  elementName: change.element.name,
  category: change.element.category,
  changedKeys: change.diffs.map((diff) => diff.key),
  before: change.before,
  after: change.after,
});

export interface RuleGap {
  readonly key: string;
  readonly label: string;
  readonly cost: boolean;
  readonly schedule: boolean;
  readonly message: string;
}

export const ruleGapsOf = (change: Change, graph: ProjectGraph): RuleGap[] =>
  ruleCoverage(underAnalysisOf(change), graph).flatMap((coverage) => {
    const label =
      change.diffs.find((diff) => diff.key === coverage.key)?.label ??
      coverage.key;
    const message = ruleGapMessage(coverage, label);
    return message ? [{ ...coverage, label, message }] : [];
  });

export interface CombinedImpactView extends CombinedImpact {
  readonly missingChangeIds: readonly string[];
}

export const combinedImpactOf = (
  impacts: ReadonlyMap<string, Impact>,
  changeIds: readonly string[],
  graph: ProjectGraph,
): CombinedImpactView | null => {
  const ids = [...new Set(changeIds)];
  const found = ids.flatMap((id) => {
    const impact = impacts.get(id);
    return impact ? [impact] : [];
  });
  if (ids.length < 2 || found.length === 0) return null;
  return {
    ...combineImpacts(found, graph.tasks),
    missingChangeIds: ids.filter((id) => !impacts.has(id)),
  };
};
