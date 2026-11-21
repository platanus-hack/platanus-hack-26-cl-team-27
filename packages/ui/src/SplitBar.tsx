import { cx } from './cx.ts';
import { formatCount } from './StatTile.tsx';

const SLOTS = ['bg-series-1', 'bg-series-2', 'bg-series-3'] as const;

export interface SplitPart {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly value: number;
}

export interface SplitBarProps {
  readonly parts: readonly SplitPart[];
  readonly label: string;
  readonly className?: string;
}

const percent = new Intl.NumberFormat('es-CL', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export function SplitBar({ parts, label, className }: SplitBarProps) {
  const shown = parts.slice(0, SLOTS.length);
  const total = shown.reduce((sum, part) => sum + part.value, 0);
  return (
    <figure className={cx('flex flex-col gap-4', className)}>
      <div
        role="img"
        aria-label={`${label}: ${shown.map((part) => `${part.label} ${part.value}`).join(', ')}`}
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2"
      >
        {shown.map((part, index) =>
          part.value > 0 ? (
            <span
              key={part.key}
              className={cx(
                'h-full first:rounded-l-full last:rounded-r-full',
                SLOTS[index],
              )}
              style={{ flexGrow: part.value, flexBasis: 0 }}
            />
          ) : null,
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {shown.map((part, index) => (
          <li key={part.key} className="flex items-center gap-3">
            <span
              aria-hidden
              className={cx('size-2.5 shrink-0 rounded-sm', SLOTS[index])}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">
                {part.label}
              </span>
              {part.description && (
                <span className="block text-xs text-ink-2">
                  {part.description}
                </span>
              )}
            </span>
            <span className="text-right text-sm tabular-nums text-ink">
              {formatCount(part.value)}
              <span className="ml-2 text-ink-2">
                {total > 0 ? percent.format(part.value / total) : '—'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
