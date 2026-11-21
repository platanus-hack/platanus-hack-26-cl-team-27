import { cx } from '@team27/ui';
import type { ReactNode } from 'react';

export function SectionHeader({
  title,
  count,
  tone = 'neutral',
  action,
  as: Heading = 'h2',
  className,
}: {
  readonly title: ReactNode;
  readonly count?: number;
  readonly tone?: 'neutral' | 'critical';
  readonly action?: ReactNode;
  readonly as?: 'h2' | 'h3';
  readonly className?: string;
}) {
  return (
    <div className={cx('flex items-center justify-between gap-3', className)}>
      <Heading className="flex items-center gap-2 text-base font-semibold text-ink">
        {title}
        {count !== undefined && (
          <span
            className={cx(
              'min-w-5 rounded-full px-1.5 text-center text-xs font-medium tabular-nums',
              tone === 'critical' && count > 0
                ? 'bg-critical text-white'
                : 'bg-surface-2 text-ink-2',
            )}
          >
            {count}
          </span>
        )}
      </Heading>
      {action}
    </div>
  );
}
