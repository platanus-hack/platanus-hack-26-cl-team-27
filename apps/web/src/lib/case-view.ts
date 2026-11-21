import type { Delta, FlowPresence, FlowState } from './flow-api.ts';
import { AFFECTED_ID } from './flow-api.ts';
import { firstName, formatCLP } from './format.ts';

const METERS = new Intl.NumberFormat('es-CL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

const HOUR_MINUTE = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const formatMeters = (value: number): string =>
  `${METERS.format(value)} m`;

export const formatHourMinute = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : HOUR_MINUTE.format(date);
};

export const describeMove = ({ dx, dy }: Delta): string => {
  const cm = (value: number) => Math.round(Math.abs(value) * 100);
  const parts: string[] = [];
  if (dy !== 0) parts.push(`${cm(dy)} cm al ${dy > 0 ? 'norte' : 'sur'}`);
  if (dx !== 0) parts.push(`${cm(dx)} cm al ${dx > 0 ? 'este' : 'oeste'}`);
  return parts.join(' y ') || 'sin desplazamiento';
};

export const formatScheduleDays = (days: number): string =>
  `${NUMBER.format(days)} ${days <= 1 ? 'día' : 'días'}`;

export const formatCostLine = (
  total: number,
  vat: boolean,
  days: number,
  critical: boolean,
): string =>
  `${formatCLP(total)}${vat ? '' : ' + IVA'}. Plazo: ${formatScheduleDays(days)}, ${
    critical ? 'mueve la entrega' : 'no mueve la entrega'
  }.`;

export const presenceOf = (
  presence: readonly FlowPresence[],
  castId: string,
): FlowPresence | null =>
  presence.find((entry) => entry.castId === castId) ?? null;

export const sentText = (flow: FlowState): string | null => {
  const { change, clash, case: info } = flow;
  if (!change) return null;
  if (change.summary) return change.summary;
  const axis = info.axis.replace(/^Eje /, 'eje ');
  const head = `Cambio enviado: ${change.elementId} se movió ${describeMove(change.delta)} (${info.level}, ${axis}).`;
  return clash
    ? `${head} Vigente encontró 1 equipo afectado: Instalaciones eléctricas (Camila Vera).`
    : head;
};

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
  const decider = proposal?.decidedByName ?? 'Camila Vera';
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
  if (resolved)
    steps.push({
      id: 'resolved',
      label:
        proposal?.resolvedText ??
        `Resuelto por ${decider} a las ${formatHourMinute(proposal?.decidedAt ?? null)}`,
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
