import type { ReactNode } from 'react';

import { cx } from './cx.ts';

const compact = new Intl.NumberFormat('es-CL', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat('es-CL');

export const formatCount = (value: number): string =>
  Math.abs(value) >= 10_000 ? compact.format(value) : full.format(value);

export interface StatTileProps {
  readonly label: string;
  readonly value: number;
  readonly hint?: ReactNode;
  readonly className?: string;
}

export function StatTile({ label, value, hint, className }: StatTileProps) {
  return (
    <div
      className={cx(
        'rounded-xl border border-hairline bg-surface p-4',
        className,
      )}
    >
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-ink">
        {formatCount(value)}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-2">{hint}</p>}
    </div>
  );
}
