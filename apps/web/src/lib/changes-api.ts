import { request } from './http';
import type { FactValue } from './format';
import { projectApi } from './project-paths';
import type { ProposalView } from './proposals-api';

export interface PropertyDiff {
  readonly key: string;
  readonly label: string;
  readonly unit: string | null;
  readonly before: FactValue | null;
  readonly after: FactValue | null;
}

export interface CostLine {
  readonly code: string;
  readonly name: string;
  readonly unit: string;
  readonly unitPrice: number;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export interface TaskImpact {
  readonly id: string;
  readonly name: string;
  readonly daysBefore: number;
  readonly daysAfter: number;
  readonly floatDays: number;
  readonly critical: boolean;
}

export interface Finding {
  readonly stakeholderId: string;
  readonly topic: 'dependency' | 'cost' | 'schedule';
  readonly summary: string;
  readonly details: readonly string[];
  readonly action: string;
}

export interface FilteredStakeholder {
  readonly stakeholderId: string;
  readonly reason: string;
}

export interface ImpactView {
  readonly costDelta: number;
  readonly delayDays: number;
  readonly projectDaysBefore: number;
  readonly projectDaysAfter: number;
  readonly costLines: readonly CostLine[];
  readonly tasks: readonly TaskImpact[];
  readonly findings: readonly Finding[];
  readonly filtered: readonly FilteredStakeholder[];
}

export interface RuleGap {
  readonly key: string;
  readonly label: string;
  readonly cost: boolean;
  readonly schedule: boolean;
  readonly message: string;
}

export interface CombinedImpactView {
  readonly changeIds: readonly string[];
  readonly missingChangeIds: readonly string[];
  readonly costDelta: number;
  readonly delayDays: number;
  readonly projectDaysBefore: number;
  readonly projectDaysAfter: number;
  readonly costLines: readonly CostLine[];
  readonly tasks: readonly TaskImpact[];
}

export interface ChangeNotification {
  readonly id: string;
  readonly changeId: string;
  readonly stakeholderId: string;
  readonly channel: string;
  readonly title: string;
  readonly link: string;
  readonly sentAt: string;
  readonly response: {
    readonly kind: 'reviewed' | 'issue' | 'not_affected';
    readonly note: string | null;
    readonly at: string;
  } | null;
}

export interface ChangeDetail {
  readonly id: string;
  readonly summary: string;
  readonly kind: 'added' | 'modified' | 'removed';
  readonly element: {
    readonly id: string;
    readonly name: string;
    readonly category: string;
  };
  readonly diffs: readonly PropertyDiff[];
  readonly detectedAt: string;
  readonly impact: ImpactView | null;
  readonly ruleGaps: readonly RuleGap[];
  readonly notifications: readonly ChangeNotification[];
  readonly proposal: ProposalView | null;
}

export const getChange = (
  projectId: string,
  changeId: string,
  signal?: AbortSignal,
): Promise<ChangeDetail> =>
  request<ChangeDetail>(projectApi(projectId, `/changes/${changeId}`), {
    signal,
  });

export type ProbabilityBand = 'alta' | 'media' | 'baja';

export interface AffectedSuggestionView {
  readonly stakeholderId: string;
  readonly probability: number;
  readonly band: ProbabilityBand;
  readonly reason: string;
  readonly evidence: string;
  readonly question: string;
  readonly name: string;
  readonly role: string | null;
}

export interface ChangeSuggestions {
  readonly changeId: string;
  readonly notifiedIds: readonly string[];
  readonly ask: readonly AffectedSuggestionView[];
  readonly watch: readonly AffectedSuggestionView[];
}

export const getChangeSuggestions = (
  projectId: string,
  changeId: string,
  signal?: AbortSignal,
): Promise<ChangeSuggestions> =>
  request<ChangeSuggestions>(
    projectApi(projectId, `/changes/${changeId}/suggestions`),
    { signal },
  );

export interface ConflictView {
  readonly otherChangeId: string;
  readonly probability: number;
  readonly band: ProbabilityBand;
  readonly reason: string;
  readonly question: string;
  readonly otherSummary: string;
  readonly otherElement: {
    readonly id: string;
    readonly name: string;
    readonly category: string;
  } | null;
  readonly otherDetectedAt: string | null;
  readonly combinedImpact: CombinedImpactView | null;
}

export interface ChangeOverlapView {
  readonly id: string;
  readonly status: string;
  readonly title: string;
  readonly otherSubjectName: string;
  readonly combinedImpact: CombinedImpactView | null;
}

export interface ChangeConflicts {
  readonly changeId: string;
  readonly overlaps: readonly ChangeOverlapView[];
  readonly conflicts: readonly ConflictView[];
  readonly watch: readonly ConflictView[];
  readonly inference: 'ok' | 'unavailable';
  readonly inferenceMessage: string | null;
}

export const getChangeConflicts = (
  projectId: string,
  changeId: string,
  signal?: AbortSignal,
): Promise<ChangeConflicts> =>
  request<ChangeConflicts>(
    projectApi(projectId, `/changes/${changeId}/conflicts`),
    { signal },
  );

export type NoticeChannel = 'email' | 'whatsapp' | 'slack';

export interface NoticeDelivery {
  readonly channel: NoticeChannel;
  readonly status: 'pending' | 'sent' | 'skipped' | 'failed';
  readonly reason: string | null;
  readonly attempts: number;
  readonly sentAt: string | null;
}

export interface ConflictNoticePreview {
  readonly kind: 'conflict';
  readonly notificationId: string;
  readonly stakeholderId: string;
  readonly name: string;
  readonly role: string;
  readonly channel: NoticeChannel;
  readonly subject: string;
  readonly text: string;
  readonly overlapId: string | null;
  readonly part: 'author' | 'affected' | null;
  readonly votes: boolean;
  readonly delivery: NoticeDelivery | null;
}

export interface NoticePreview {
  readonly kind: 'change';
  readonly notificationId: string;
  readonly stakeholderId: string;
  readonly name: string;
  readonly role: string;
  readonly noticeRole: 'costos' | 'planificacion' | 'ingenieria';
  readonly channel: NoticeChannel;
  readonly subject: string;
  readonly text: string;
  readonly why: string;
  readonly whySource: 'modelo' | 'plantilla';
  readonly delivery: NoticeDelivery | null;
}

export interface ChangeNotices {
  readonly changeId: string;
  readonly inference: 'ok' | 'unavailable';
  readonly notices: readonly NoticePreview[];
  readonly conflictNotices: readonly ConflictNoticePreview[];
}

export const getChangeNotices = (
  projectId: string,
  changeId: string,
  signal?: AbortSignal,
): Promise<ChangeNotices> =>
  request<ChangeNotices>(
    projectApi(projectId, `/changes/${changeId}/notices`),
    { signal },
  );
