import { cx } from '@team27/ui';

import { formatSignedCLP, formatSignedDays } from '@/lib/format';

export interface CostDelayProps {
  readonly costDelta: number;
  readonly delayDays: number;
  readonly large?: boolean;
  readonly className?: string;
}

export function CostDelay({
  costDelta,
  delayDays,
  large = false,
  className,
}: CostDelayProps) {
  return (
    <dl
      className={cx(
        'flex flex-wrap gap-x-6 gap-y-1',
        large ? 'text-xl' : 'text-sm',
        className,
      )}
    >
      <div className="flex items-baseline gap-2">
        <dt className="text-ink-2">Costo</dt>
        <dd className="font-semibold tabular-nums text-ink">
          {costDelta === 0 ? 'Sin cambio' : formatSignedCLP(costDelta)}
        </dd>
      </div>
      <div className="flex items-baseline gap-2">
        <dt className="text-ink-2">Plazo</dt>
        <dd className="font-semibold tabular-nums text-ink">
          {formatSignedDays(delayDays)}
        </dd>
      </div>
    </dl>
  );
}
