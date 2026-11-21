export const FLOW_PROPOSAL_STATUSES = [
  'propuesta',
  'aceptada',
  'aplicada',
  'resuelta',
  'rechazada',
] as const;

export type FlowProposalStatus = (typeof FLOW_PROPOSAL_STATUSES)[number];

const NEXT: Readonly<
  Record<FlowProposalStatus, readonly FlowProposalStatus[]>
> = {
  propuesta: ['aceptada', 'rechazada'],
  aceptada: ['aplicada'],
  aplicada: ['resuelta'],
  resuelta: [],
  rechazada: [],
};

export const canAdvance = (
  from: FlowProposalStatus,
  to: FlowProposalStatus,
): boolean => NEXT[from].includes(to);

export const isDecided = (status: FlowProposalStatus): boolean =>
  status !== 'propuesta';

export const isClosed = (status: FlowProposalStatus): boolean =>
  NEXT[status].length === 0;
