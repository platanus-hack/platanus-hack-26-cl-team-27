import type { FlowPresence, FlowState } from './flow-api.ts';
import { AFFECTED_ID } from './flow-api.ts';
import { firstName } from './format.ts';

export const presenceOf = (
  presence: readonly FlowPresence[],
  castId: string,
): FlowPresence | null =>
  presence.find((entry) => entry.castId === castId) ?? null;

export const sentText = (flow: FlowState): string | null =>
  flow.change?.summary ?? null;

export type StepState = 'done' | 'current' | 'pending' | 'problem';

export interface TimelineStep {
  readonly id: string;
  readonly label: string;
  readonly state: StepState;
}

export const authorTimeline = (flow: FlowState): readonly TimelineStep[] => {
  const { change, clash, proposal, presence } = flow;
  const camila = presenceOf(presence, AFFECTED_ID);
  const reviewing = camila?.online === true && camila.viewing === 'propuesta';
  const resolved = proposal?.status === 'resuelta';
  const rejected = proposal?.status === 'rechazada';
  const decider = proposal?.decidedByName ?? '';
  const steps: TimelineStep[] = [
    {
      id: 'sent',
      label: change ? 'Cambio enviado' : 'Aún no envías el cambio',
      state: change ? 'done' : 'current',
    },
  ];
  if (!change) return steps;
  steps.push({
    id: 'affects',
    label: clash
      ? 'Afecta a Camila Vera (Instalaciones eléctricas)'
      : 'Buscando equipos afectados…',
    state: clash ? 'done' : 'current',
  });
  if (!clash) return steps;
  steps.push({
    id: 'review',
    label:
      resolved || rejected
        ? `${firstName(decider)} revisó tu cambio`
        : reviewing
          ? 'Camila está revisando tu cambio'
          : 'Esperando a Camila…',
    state: resolved || rejected ? 'done' : 'current',
  });
  if (resolved && proposal?.resolvedText)
    steps.push({
      id: 'resolved',
      label: proposal.resolvedText,
      state: 'done',
    });
  if (rejected)
    steps.push({
      id: 'rejected',
      label: `${decider} tiene un problema: ${proposal?.rejectReason ?? 'sin detalle'}`,
      state: 'problem',
    });
  return steps;
};
