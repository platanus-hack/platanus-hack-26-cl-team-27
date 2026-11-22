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

export interface ChangeNotification {
  readonly id: string;
  readonly changeId: string;
  readonly stakeholderId: string;
  readonly channel: string;
  readonly title: string;
  readonly link: string;
  readonly sentAt: string;
  readonly response: {
    readonly kind: 'reviewed' | 'issue';
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
