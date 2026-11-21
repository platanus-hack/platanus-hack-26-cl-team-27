const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const NUMBER = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

const CLOCK = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export type FactValue = number | string;

export const MINUS = '−';

export const formatCLP = (amount: number): string => CLP.format(amount);

export const formatSignedCLP = (amount: number): string => {
  if (amount === 0) return CLP.format(0);
  return `${amount > 0 ? '+' : MINUS}${CLP.format(Math.abs(amount))}`;
};

export const formatDays = (days: number): string =>
  `${NUMBER.format(days)} ${days === 1 ? 'día' : 'días'}`;

export const formatSignedDays = (days: number): string => {
  if (days === 0) return 'Sin atraso';
  return `${days > 0 ? '+' : MINUS}${formatDays(Math.abs(days))}`;
};

export const formatNumber = (value: number): string => NUMBER.format(value);

export const formatValue = (value: FactValue, unit: string | null): string => {
  const text = typeof value === 'number' ? NUMBER.format(value) : value;
  return unit ? `${text} ${unit}` : text;
};

export const formatClock = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : CLOCK.format(date);
};

export const joinNames = (names: readonly string[]): string => {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
};

export const firstName = (name: string): string => name.split(' ')[0] ?? name;

export const plural = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

export const formatChange = (
  before: FactValue | null,
  after: FactValue | null,
  unit: string | null,
): string =>
  `${before === null ? 'Sin dato' : formatValue(before, unit)} → ${
    after === null ? 'Se elimina' : formatValue(after, unit)
  }`;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const formatRelative = (iso: string, now: number): string => {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return '';
  if (now <= 0) return formatClock(iso);
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return 'Recién';
  if (elapsed < HOUR) return `Hace ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < 24 * HOUR) return `Hace ${Math.floor(elapsed / HOUR)} h`;
  return formatClock(iso);
};

export const latest = (dates: readonly (string | null)[]): string | null =>
  dates.reduce<string | null>(
    (best, date) =>
      date !== null && (best === null || date > best) ? date : best,
    null,
  );
