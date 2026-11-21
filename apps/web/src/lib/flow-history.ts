import type { FlowState } from './flow-api';
import type {
  HistoryApproval,
  HistoryKind,
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
  kind: HistoryKind = 'arreglo',
): string | null => {
  if (approvals.length === 0) return null;
  const names = joinNames(approvals.map((approval) => approval.name));
  const time = formatHourMinute(approvals[0]!.at);
  if (kind !== 'arreglo')
    return time
      ? `${names} aprobó la propuesta a las ${time}`
      : `${names} aprobó la propuesta`;
  return time ? `Aprobó ${names} a las ${time}` : `Aprobó ${names}`;
};

export const valueText = (value: string): string =>
  value.replace(/(\d)\.(\d)/g, '$1,$2');

const shortId = (id: string): string => (id.length > 12 ? id.slice(0, 8) : id);

export const documentText = (entry: HistoryEntry): string => {
  const name = entry.document.split(' ')[0] ?? entry.document;
  if (entry.kind === 'base') return entry.document;
  const label =
    entry.kind === 'arreglo'
      ? `Propuesta de Vigente sobre ${name}`
      : `${name} · minuta ${shortId(entry.minuteId ?? '')}`;
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
