export type FindingTopic = 'dependency' | 'cost' | 'schedule';

export interface Finding {
  readonly stakeholderId: string;
  readonly topic: FindingTopic;
  readonly summary: string;
  readonly details: readonly string[];
  readonly action: string;
}

export interface Filtered {
  readonly stakeholderId: string;
  readonly reason: string;
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

export interface Impact {
  readonly changeId: string;
  readonly costDelta: number;
  readonly delayDays: number;
  readonly projectDaysBefore: number;
  readonly projectDaysAfter: number;
  readonly costLines: readonly CostLine[];
  readonly tasks: readonly TaskImpact[];
  readonly findings: readonly Finding[];
  readonly filtered: readonly Filtered[];
}
