import { cx } from '@team27/ui';

import { Icon, type IconName } from './Icon';
import type { Tone } from './StateMark';

const LOOK: Record<Tone, string> = {
  good: 'bg-good/12 text-good-text',
  warning: 'bg-warning/20 text-ink',
  serious: 'bg-serious/20 text-ink',
  critical: 'bg-critical/12 text-critical-text',
  neutral: 'bg-surface-2 text-ink-2',
};

const ICON: Record<Tone, string> = {
  good: 'text-good',
  warning: 'text-warning',
  serious: 'text-serious',
  critical: 'text-critical',
  neutral: 'text-ink-3',
};

export function StatusChip({
  tone,
  icon,
  label,
  className,
}: {
  readonly tone: Tone;
  readonly icon: IconName;
  readonly label: string;
  readonly className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full py-0.5 pr-2.5 pl-1.5 text-xs font-medium',
        LOOK[tone],
        className,
      )}
    >
      <Icon name={icon} className={cx('size-3.5', ICON[tone])} />
      {label}
    </span>
  );
}
