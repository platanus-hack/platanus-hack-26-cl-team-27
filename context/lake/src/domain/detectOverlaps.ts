import { NO_FOOTPRINT, sameFootprint, sharedAreas } from './AreaCell.ts';
import type { Footprint, FootprintModel } from './AreaCell.ts';
import type { BaselineEntry } from './Baseline.ts';
import type { Claim, ClaimValue } from './Claim.ts';
import { isLiveOverlap, overlapKey } from './Overlap.ts';
import type {
  Overlap,
  OverlapBacking,
  OverlapDraft,
  OverlapResolution,
} from './Overlap.ts';
import { isActive, subjectsOf } from './Proposal.ts';
import type { Proposal, ProposalChange } from './Proposal.ts';
import type { Revision } from './Revision.ts';

type Values = Record<string, ClaimValue>;

export interface OverlapContext {
  readonly baseline: readonly BaselineEntry[];
  readonly proposals: readonly Proposal[];
  readonly footprint: FootprintModel;
}

export interface DetectOverlapsInput extends OverlapContext {
  readonly revision: Revision;
  readonly revisions: readonly Revision[];
  readonly claims: readonly Claim[];
  readonly incoming: readonly Proposal[];
}

export const baselineValues = (
  subject: string,
  baseline: readonly BaselineEntry[],
): Values => {
  const values: Values = {};
  for (const entry of baseline) {
    if (entry.subject === subject) values[entry.attribute] = entry.value;
  }
  return values;
};

const byOpenedAt = (a: Proposal, b: Proposal): number =>
  a.openedAt.getTime() - b.openedAt.getTime();

export const activeFor = (
  subject: string,
  proposals: readonly Proposal[],
): Proposal[] =>
  proposals
    .filter(
      (proposal) =>
        isActive(proposal) && subjectsOf(proposal).includes(subject),
    )
    .sort(byOpenedAt);

export const finalValues = (
  subject: string,
  baseline: readonly BaselineEntry[],
  proposals: readonly Proposal[],
): Values => {
  const values = baselineValues(subject, baseline);
  for (const proposal of activeFor(subject, proposals)) {
    for (const change of proposal.changes) {
      if (change.subject === subject) values[change.attribute] = change.after;
    }
  }
  return values;
};

const occupantFootprint = (
  footprint: FootprintModel,
  subject: string,
  values: Values,
): Footprint => {
  const result = footprint(subject, values);
  return result.kind === 'ocupante' && result.areas.length > 0
    ? result
    : NO_FOOTPRINT;
};

const subjectsIn = (
  baseline: readonly BaselineEntry[],
  proposals: readonly Proposal[],
): string[] =>
  [
    ...new Set([
      ...baseline.map((entry) => entry.subject),
      ...proposals.flatMap((proposal) => subjectsOf(proposal)),
    ]),
  ].sort();

const backingRevision = (
  subject: string,
  context: OverlapContext,
  revisions: readonly Revision[],
  movedByProposal: boolean,
): Revision | null => {
  const byId = (id: string): Revision | null =>
    revisions.find((revision) => revision.id === id) ?? null;
  if (movedByProposal) {
    const latest = activeFor(subject, context.proposals).pop();
    if (latest) return byId(latest.sourceRevisionId);
  }
  const entries = context.baseline
    .filter((entry) => entry.subject === subject)
    .sort(
      (a, b) => b.since.getTime() - a.since.getTime() || b.version - a.version,
    );
  const first = entries[0];
  return first ? byId(first.revisionId) : null;
};

const toBacking = (revision: Revision): OverlapBacking => ({
  documentId: revision.documentId,
  label: revision.label,
  ownerId: revision.authorId,
});

const locatorFor = (
  proposal: Proposal,
  subject: string,
  claims: readonly Claim[],
  relevant: (change: ProposalChange) => boolean,
): string => {
  const changes = proposal.changes.filter(
    (change) => change.subject === subject,
  );
  const chosen = changes.find(relevant) ?? changes[0];
  if (chosen?.locator) return chosen.locator;
  const claim = claims.find((candidate) => candidate.id === chosen?.claimId);
  return claim?.locator ?? '';
};

const validatorsOf = (
  revision: Revision,
  backing: OverlapBacking,
): string[] => [...new Set([revision.authorId, backing.ownerId])];

export const detectOverlaps = (input: DetectOverlapsInput): OverlapDraft[] => {
  const { revision, revisions, claims, baseline, footprint } = input;
  const context: OverlapContext = {
    baseline,
    proposals: input.proposals,
    footprint,
  };
  const active = input.proposals.filter(isActive);
  const drafts: OverlapDraft[] = [];
  const seen = new Set<string>();
  const push = (draft: OverlapDraft): void => {
    const key = overlapKey(draft);
    if (seen.has(key)) return;
    seen.add(key);
    drafts.push(draft);
  };
  const subjects = subjectsIn(baseline, active);

  for (const proposal of input.incoming.filter(isActive)) {
    for (const other of active) {
      if (
        other.id === proposal.id ||
        other.documentId === proposal.documentId
      ) {
        continue;
      }
      const shared = subjectsOf(proposal).filter((subject) =>
        subjectsOf(other).includes(subject),
      );
      for (const subject of shared) {
        const mine = proposal.changes.filter((c) => c.subject === subject);
        const theirs = other.changes.filter((c) => c.subject === subject);
        const disjoint = mine.every((change) =>
          theirs.every((candidate) => candidate.attribute !== change.attribute),
        );
        if (!disjoint) continue;
        const source = revisions.find(
          (candidate) => candidate.id === other.sourceRevisionId,
        );
        if (!source) continue;
        const backing = toBacking(source);
        push({
          proposalId: proposal.id,
          otherProposalId: other.id,
          revisionId: revision.id,
          chunkLocator: locatorFor(proposal, subject, claims, () => true),
          kind: 'mismo-elemento',
          area: null,
          relation: null,
          subjectId: subject,
          otherSubjectId: subject,
          otherBacking: backing,
          validators: validatorsOf(revision, backing),
        });
      }
    }

    for (const subject of subjectsOf(proposal)) {
      const next = occupantFootprint(
        footprint,
        subject,
        finalValues(subject, baseline, active),
      );
      if (next.areas.length === 0) continue;
      const before = occupantFootprint(
        footprint,
        subject,
        baselineValues(subject, baseline),
      );
      if (sameFootprint(before, next)) continue;

      const relevant = (change: ProposalChange): boolean => {
        const values = baselineValues(subject, baseline);
        const moved = occupantFootprint(footprint, subject, {
          ...values,
          [change.attribute]: change.after,
        });
        return !sameFootprint(before, moved);
      };

      for (const target of subjects) {
        if (target === subject) continue;
        const targetNext = occupantFootprint(
          footprint,
          target,
          finalValues(target, baseline, active),
        );
        if (targetNext.areas.length === 0) continue;
        const [hit] = sharedAreas(next, targetNext);
        if (!hit) continue;
        const targetBefore = occupantFootprint(
          footprint,
          target,
          baselineValues(target, baseline),
        );
        const activeTarget = activeFor(target, active).filter(
          (candidate) => candidate.id !== proposal.id,
        );
        const moved =
          activeTarget.length > 0 && !sameFootprint(targetBefore, targetNext);
        const source = backingRevision(target, context, revisions, moved);
        if (!source) continue;
        const backing = toBacking(source);
        push({
          proposalId: proposal.id,
          otherProposalId: moved
            ? (activeTarget[activeTarget.length - 1]?.id ?? null)
            : null,
          revisionId: revision.id,
          chunkLocator: locatorFor(proposal, subject, claims, relevant),
          kind: moved ? 'simultaneo' : 'misma-area',
          area: hit.area,
          relation: hit.relation,
          subjectId: subject,
          otherSubjectId: target,
          otherBacking: backing,
          validators: validatorsOf(revision, backing),
        });
      }
    }
  }
  return drafts;
};

export interface OverlapResolutionItem {
  readonly overlapId: string;
  readonly resolution: OverlapResolution;
}

const closedReason = (proposal: Proposal): OverlapResolution | null => {
  if (proposal.status === 'withdrawn') return 'retirada';
  if (proposal.status === 'superseded') return 'reemplazada';
  return null;
};

export const reassessOverlaps = (
  overlaps: readonly Overlap[],
  context: OverlapContext,
): OverlapResolutionItem[] => {
  const active = context.proposals.filter(isActive);
  const byId = new Map(context.proposals.map((p) => [p.id, p]));
  const result: OverlapResolutionItem[] = [];
  for (const overlap of overlaps.filter(isLiveOverlap)) {
    const own = overlap.proposalId ? byId.get(overlap.proposalId) : undefined;
    const other = overlap.otherProposalId
      ? byId.get(overlap.otherProposalId)
      : undefined;
    const ownReason = own ? closedReason(own) : null;
    if (ownReason) {
      result.push({ overlapId: overlap.id, resolution: ownReason });
      continue;
    }
    if (overlap.kind === 'mismo-elemento') {
      if (other && !isActive(other)) {
        result.push({
          overlapId: overlap.id,
          resolution: 'otra_propuesta_cerrada',
        });
      }
      continue;
    }
    if (own && own.status === 'merged') continue;
    const left = occupantFootprint(
      context.footprint,
      overlap.subjectId,
      finalValues(overlap.subjectId, context.baseline, active),
    );
    const rightValues =
      overlap.kind === 'simultaneo'
        ? finalValues(overlap.otherSubjectId, context.baseline, active)
        : baselineValues(overlap.otherSubjectId, context.baseline);
    const right = occupantFootprint(
      context.footprint,
      overlap.otherSubjectId,
      rightValues,
    );
    if (sharedAreas(left, right).length === 0) {
      result.push({ overlapId: overlap.id, resolution: 'sin_area_comun' });
    }
  }
  return result;
};
