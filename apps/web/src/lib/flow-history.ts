import type { FlowState } from './flow-api';
import type {
  HistoryApproval,
  HistoryEntry,
  HistoryPending,
} from './flow-history-api';
import { joinNames } from './format';

const pad = (value: number): string => String(value).padStart(2, '0');

export const formatHourMinute = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const approvalText = (
  approvals: readonly HistoryApproval[],
): string | null => {
  if (approvals.length === 0) return null;
  const names = joinNames(approvals.map((approval) => approval.name));
  const first = approvals[0]!;
  const time = formatHourMinute(first.at);
  return time ? `Aprobó ${names} a las ${time}` : `Aprobó ${names}`;
};

export const authorText = (entry: HistoryEntry): string =>
  entry.kind === 'arreglo'
    ? `${entry.by.name} propuso`
    : `por ${entry.by.name}`;

export const documentText = (entry: HistoryEntry): string => {
  const label = entry.minuteId
    ? `${entry.document.split(' ')[0] ?? entry.document} · ${entry.minuteId}`
    : entry.document;
  return entry.source ? `${label} (${entry.source})` : label;
};

export const pendingText = (
  pending: HistoryPending,
  viewerId: string | null,
): string => {
  if (pending.status === 'rechazada')
    return pending.reason ? `Rechazada: ${pending.reason}` : 'Rechazada';
  const awaiting = pending.awaiting ?? [];
  if (viewerId && awaiting.some((person) => person.id === viewerId))
    return 'Pendiente de tu respuesta';
  if (awaiting.length === 0) return pending.text;
  return `Pendiente de ${joinNames(awaiting.map((person) => person.name))}`;
};

export const historyKey = (flow: FlowState): string =>
  `${flow.epoch}:${flow.proposal?.status ?? 'none'}:${flow.change?.minuteId ?? ''}`;
