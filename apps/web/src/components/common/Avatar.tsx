import { cx } from '@team27/ui';

import { Icon } from './Icon';
import { initials } from './initials';

export type Decision = 'approve' | 'dispute' | null;

const SIZE = {
  sm: 'size-7 text-[0.7rem]',
  md: 'size-9 text-xs',
  lg: 'size-10 text-sm',
} as const;

const RING = {
  approve: 'ring-2 ring-good',
  dispute: 'ring-2 ring-critical',
  pending: 'ring-1 ring-hairline',
} as const;

const BADGE = {
  approve: { icon: 'check', className: 'text-good' },
  dispute: { icon: 'alert', className: 'text-critical' },
  pending: { icon: 'hourglass', className: 'text-ink-3' },
} as const;

export function Avatar({
  name,
  size = 'md',
  decision,
  tone = 'neutral',
  className,
}: {
  readonly name: string;
  readonly size?: keyof typeof SIZE;
  readonly decision?: Decision;
  readonly tone?: 'neutral' | 'accent';
  readonly className?: string;
}) {
  const state = decision === undefined ? null : (decision ?? 'pending');
  return (
    <span
      aria-hidden
      className={cx(
        'relative inline-grid shrink-0 place-items-center rounded-full font-semibold',
        tone === 'accent'
          ? 'bg-accent text-on-accent'
          : 'bg-surface-2 text-ink',
        SIZE[size],
        state && RING[state],
        className,
      )}
    >
      {initials(name)}
      {state && (
        <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-surface">
          <Icon
            name={BADGE[state].icon}
            filled
            className={cx('size-4', BADGE[state].className)}
          />
        </span>
      )}
    </span>
  );
}
