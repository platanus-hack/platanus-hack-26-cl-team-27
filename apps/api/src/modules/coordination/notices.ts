import {
  type ChangeBrief,
  ExplainNotices,
  type Impact,
  InferenceUnavailableError,
  type NoticeReason,
  type ProjectGraph,
} from '@team27/context-impact';
import {
  isLiveOverlap,
  type Overlap,
  type Proposal,
} from '@team27/context-lake';
import {
  fallbackWhy,
  type NoticeClash,
  type NoticeImpact,
  noticeOf,
  noticeRoleOf,
  type Notification,
  renderNotice,
} from '@team27/context-notification';

import type { ProjectCatalog } from '../project/project-catalog.ts';
import { combinedImpactOf } from './impact.ts';

const figuresOf = (
  impact: { readonly costDelta: number; readonly delayDays: number } | null,
): NoticeImpact | null =>
  impact ? { costDelta: impact.costDelta, delayDays: impact.delayDays } : null;

export interface OverlapClashesInput {
  readonly project: ProjectCatalog;
  readonly overlaps: readonly Overlap[];
  readonly proposals: readonly Proposal[];
  readonly impacts: ReadonlyMap<string, Impact>;
  readonly proposalId: string;
  readonly changeId: string;
}

export const overlapClashes = (input: OverlapClashesInput): NoticeClash[] => {
  const { project, proposalId, changeId } = input;
  return input.overlaps
    .filter(
      (overlap) =>
        isLiveOverlap(overlap) &&
        (overlap.proposalId === proposalId ||
          overlap.otherProposalId === proposalId),
    )
    .map((overlap) => {
      const mine = overlap.proposalId === proposalId;
      const own = project.subjectName(
        mine ? overlap.subjectId : overlap.otherSubjectId,
      );
      const other = project.subjectName(
        mine ? overlap.otherSubjectId : overlap.subjectId,
      );
      const otherProposalId = mine
        ? overlap.otherProposalId
        : overlap.proposalId;
      const otherChangeIds =
        input.proposals
          .find((proposal) => proposal.id === otherProposalId)
          ?.changeIds.filter((id) => id !== changeId) ?? [];
      return {
        with: other,
        question: overlap.area
          ? `¿Se topan ${own} y ${other} en ${project.areaLabel(overlap.area)}?`
          : `¿Se topan ${own} y ${other}?`,
        combined: figuresOf(
          combinedImpactOf(
            input.impacts,
            [changeId, ...otherChangeIds],
            project.graph,
          ),
        ),
      };
    });
};

export interface EstimatedClash {
  readonly otherChangeId: string;
  readonly question: string;
  readonly otherSummary: string;
  readonly otherElement: { readonly name: string } | null;
}

export const estimatedClashes = (
  conflicts: readonly EstimatedClash[],
  impacts: ReadonlyMap<string, Impact>,
  changeId: string,
  graph: ProjectGraph,
): NoticeClash[] =>
  conflicts.map((conflict) => ({
    with: conflict.otherElement?.name ?? conflict.otherSummary,
    question: conflict.question,
    combined: figuresOf(
      combinedImpactOf(impacts, [changeId, conflict.otherChangeId], graph),
    ),
  }));

export interface ReasonsResult {
  readonly reasons: readonly NoticeReason[];
  readonly inference: 'ok' | 'unavailable';
}

export const reasonsFor = async (
  explain: ExplainNotices,
  change: ChangeBrief,
  project: ProjectCatalog,
  notifications: readonly Notification[],
): Promise<ReasonsResult> => {
  try {
    const reasons = await explain.execute({
      change,
      recipients: notifications.map((notification) => {
        const member = project.castMember(notification.stakeholderId);
        return {
          stakeholderId: notification.stakeholderId,
          name: member?.name ?? notification.stakeholderId,
          role: member?.role ?? '',
          findings: notification.findings.map((finding) => finding.summary),
        };
      }),
    });
    return { reasons, inference: 'ok' };
  } catch (error) {
    if (error instanceof InferenceUnavailableError) {
      return { reasons: [], inference: 'unavailable' };
    }
    throw error;
  }
};

export interface NoticePreviewInput {
  readonly project: ProjectCatalog;
  readonly notifications: readonly Notification[];
  readonly impact: NoticeImpact | null;
  readonly clashes: readonly NoticeClash[];
  readonly reasons: readonly NoticeReason[];
  readonly baseUrl: string;
}

const sameClash = (a: NoticeClash, b: NoticeClash): boolean =>
  a.with === b.with;

export const noticePreviews = (input: NoticePreviewInput) =>
  input.notifications.map((notification) => {
    const member = input.project.castMember(notification.stakeholderId);
    const role = member?.role ?? notification.context?.role ?? '';
    const noticeRole = noticeRoleOf(role, notification.findings);
    const channel = member?.channel ?? notification.channel;
    const written =
      input.reasons.find(
        (reason) => reason.stakeholderId === notification.stakeholderId,
      )?.why ?? null;
    const stored = notification.context?.clashes ?? [];
    const rendered = renderNotice(
      {
        ...noticeOf(notification, input.baseUrl, written),
        recipientName:
          member?.name ?? notification.context?.recipientName ?? null,
        impact: notification.context?.impact ?? input.impact,
        clashes: [
          ...input.clashes,
          ...stored.filter(
            (clash) => !input.clashes.some((item) => sameClash(item, clash)),
          ),
        ],
      },
      noticeRole,
      channel,
    );
    return {
      notificationId: notification.id,
      stakeholderId: notification.stakeholderId,
      name: member?.name ?? notification.stakeholderId,
      role,
      noticeRole,
      channel,
      subject: rendered.subject,
      text: rendered.text,
      why: written ?? fallbackWhy(notification.findings, noticeRole),
      whySource: written ? ('modelo' as const) : ('plantilla' as const),
    };
  });
