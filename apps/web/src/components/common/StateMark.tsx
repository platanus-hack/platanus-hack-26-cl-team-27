import { cx } from '@team27/ui';

import { Icon, type IconName } from './Icon';

const TONES = {
  good: 'text-good-text',
  warning: 'text-ink',
  serious: 'text-ink',
  critical: 'text-critical-text',
  neutral: 'text-ink-2',
} as const;

const ICON_TONES = {
  good: 'text-good',
  warning: 'text-warning',
  serious: 'text-serious',
  critical: 'text-critical',
  neutral: 'text-ink-3',
} as const;

export type Tone = keyof typeof TONES;

export interface StateMarkProps {
  readonly tone: Tone;
  readonly icon: IconName;
  readonly label: string;
  readonly large?: boolean;
  readonly className?: string;
}

export function StateMark({
  tone,
  icon,
  label,
  large = false,
  className,
}: StateMarkProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 font-medium',
        large ? 'text-lg' : 'text-sm',
        TONES[tone],
        className,
      )}
    >
      <Icon
        name={icon}
        filled
        className={cx(large ? 'size-6' : 'size-4', ICON_TONES[tone])}
      />
      {label}
    </span>
  );
}
