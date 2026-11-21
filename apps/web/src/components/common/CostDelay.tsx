import { cx } from '@team27/ui';

import { formatSignedCLP, formatSignedDays } from '@/lib/format';

import { Icon } from './Icon';

export interface CostDelayProps {
  readonly costDelta: number;
  readonly delayDays: number;
  readonly className?: string;
}

export const costText = (costDelta: number): string =>
  costDelta === 0 ? 'Sin costo' : formatSignedCLP(costDelta);

export function CostDelay({ costDelta, delayDays, className }: CostDelayProps) {
  return (
    <dl
      className={cx(
        'flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums',
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <dt>
          <Icon name="coins" className="text-ink-3" />
          <span className="sr-only">Costo</span>
        </dt>
        <dd className="font-medium text-ink">{costText(costDelta)}</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt>
          <Icon name="calendar" className="text-ink-3" />
          <span className="sr-only">Plazo</span>
        </dt>
        <dd className="font-medium text-ink">{formatSignedDays(delayDays)}</dd>
      </div>
    </dl>
  );
}
