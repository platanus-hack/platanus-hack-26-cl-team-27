import { request } from './http';

export interface HistoryActor {
  readonly id: string;
  readonly name: string;
}

export interface HistoryApproval extends HistoryActor {
  readonly at: string;
}

export type HistoryKind = 'base' | 'minuta' | 'arreglo';

export interface HistoryEntry {
  readonly current: boolean;
  readonly kind: HistoryKind;
  readonly value: string;
  readonly unit: string | null;
  readonly at: string;
  readonly until?: string | null;
  readonly by: HistoryActor;
  readonly document: string;
  readonly source: string | null;
  readonly minuteId: string | null;
  readonly reason: string | null;
  readonly text: string;
  readonly approvedBy: readonly HistoryApproval[];
  readonly proposalId: string | null;
}

export interface HistoryPending {
  readonly value: string;
  readonly by: HistoryActor;
  readonly at: string;
  readonly status: 'propuesta' | 'rechazada';
  readonly awaiting?: readonly HistoryActor[];
  readonly reason?: string | null;
  readonly text: string;
}

export interface HistoryElement {
  readonly elementId: string;
  readonly subjectId: string;
  readonly attribute: string;
  readonly name: string;
  readonly link: string;
  readonly pending: HistoryPending | null;
  readonly entries: readonly HistoryEntry[];
}

export interface FlowHistory {
  readonly epoch: number;
  readonly elements: readonly HistoryElement[];
}

export const getFlowHistory = (signal?: AbortSignal): Promise<FlowHistory> =>
  request<FlowHistory>('/api/flow/history', { signal });
