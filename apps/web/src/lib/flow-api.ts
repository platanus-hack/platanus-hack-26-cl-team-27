import { request, type Auth } from './http';

export type Axis = 'x' | 'y' | 'z';

export interface Delta {
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}

export interface FlowBox {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface FlowElement {
  readonly id: string;
  readonly name: string;
  readonly discipline: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly box: FlowBox;
  readonly movable: boolean;
}

export interface FlowChange {
  readonly id: string;
  readonly minuteId: string;
  readonly elementId: string;
  readonly delta: Delta;
  readonly reason: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly at: string;
  readonly summary: string;
  readonly waiting: string;
}

export interface FlowClash {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  readonly penetration: number;
  readonly axis: 'y';
  readonly noAutoFix: boolean;
  readonly status: 'detectada' | 'resuelta';
  readonly area: { readonly level: string; readonly near: string };
}

export type ProposalStatus =
  'propuesta' | 'aceptada' | 'aplicada' | 'resuelta' | 'rechazada';

export interface FlowCostLine {
  readonly code?: string;
  readonly detail?: string;
  readonly quantity?: number;
  readonly unit?: string;
  readonly price?: number;
  readonly total?: number;
}

export interface FlowProposal {
  readonly id: string;
  readonly clashId: string;
  readonly elementId: string;
  readonly ownerId: string;
  readonly delta: Delta;
  readonly segment: { readonly fromX: number; readonly toX: number };
  readonly clearanceAfter: number;
  readonly checks: readonly { readonly label: string; readonly ok: boolean }[];
  readonly cost: {
    readonly lines: readonly FlowCostLine[];
    readonly total: number;
    readonly currency: string;
    readonly vat: boolean;
  };
  readonly schedule: { readonly days: number; readonly critical: boolean };
  readonly texts: {
    readonly title: string;
    readonly why: string;
    readonly proposal: string;
    readonly cost: string;
    readonly footer: string;
  };
  readonly appliedText: string | null;
  readonly resolvedText: string | null;
  readonly status: ProposalStatus;
  readonly decidedBy: string | null;
  readonly decidedByName: string | null;
  readonly decidedAt: string | null;
  readonly rejectReason: string | null;
}

export type Viewing = 'plano' | 'propuesta';

export interface FlowPresence {
  readonly castId: string;
  readonly name: string;
  readonly online: boolean;
  readonly viewing: Viewing | null;
}

export interface FlowState {
  readonly epoch: number;
  readonly case: {
    readonly id: string;
    readonly title: string;
    readonly level: string;
    readonly axis: string;
  };
  readonly elements: readonly FlowElement[];
  readonly change: FlowChange | null;
  readonly clash: FlowClash | null;
  readonly proposal: FlowProposal | null;
  readonly presence: readonly FlowPresence[];
}

export interface MinuteBody {
  readonly minuteId: string;
  readonly source: 'sala' | 'revit';
  readonly model: { readonly title: string; readonly discipline: string };
  readonly changes: readonly {
    readonly elementId: string;
    readonly attribute: 'location';
    readonly delta: Delta;
    readonly reason: string;
  }[];
}

export const AUTHOR_ID = 'paula-rojas';
export const AFFECTED_ID = 'camila-vera';
export const MOVED_ELEMENT = 'P-12';
export const MOVE_REASON =
  'Alinear con el muro de corte M-6 y bajar la torsión';

export const buildMinute = (minuteId: string): MinuteBody => ({
  minuteId,
  source: 'sala',
  model: { title: 'LosAromos_EST', discipline: 'estructura' },
  changes: [
    {
      elementId: MOVED_ELEMENT,
      attribute: 'location',
      delta: { dx: 0, dy: 0.4, dz: 0 },
      reason: MOVE_REASON,
    },
  ],
});

export const getFlow = (signal?: AbortSignal): Promise<FlowState> =>
  request<FlowState>('/api/flow', { signal });

export const postMinute = (body: MinuteBody, auth: Auth): Promise<FlowState> =>
  request<FlowState>('/api/flow/minutes', { method: 'POST', body, ...auth });

export const acceptProposal = (
  proposalId: string,
  auth: Auth,
): Promise<FlowState> =>
  request<FlowState>(`/api/flow/proposals/${proposalId}/accept`, {
    method: 'POST',
    body: {},
    ...auth,
  });

export const rejectProposal = (
  proposalId: string,
  reason: string,
  auth: Auth,
): Promise<FlowState> =>
  request<FlowState>(`/api/flow/proposals/${proposalId}/reject`, {
    method: 'POST',
    body: { reason },
    ...auth,
  });

export const postPresence = (viewing: Viewing, auth: Auth): Promise<void> =>
  request<void>('/api/flow/presence', {
    method: 'POST',
    body: { viewing },
    ...auth,
  });

export const resetFlow = (auth: Auth): Promise<void> =>
  request<void>('/api/flow/reset', { method: 'POST', body: {}, ...auth });
