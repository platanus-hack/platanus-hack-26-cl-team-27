import { cx } from '@team27/ui';
import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

const TONES = {
  accent: 'bg-accent-soft/60 text-accent-text',
  good: 'bg-good/15 text-good-text',
  critical: 'bg-critical/12 text-critical-text',
  warning: 'bg-warning/20 text-ink',
  neutral: 'bg-surface-2 text-ink-2',
  change: 'bg-blueprint text-change',
} as const;

export type BadgeTone = keyof typeof TONES;

export function IconBadge({
  icon,
  tone = 'accent',
  size = 'md',
  className,
}: {
  readonly icon: IconName;
  readonly tone?: BadgeTone;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-grid shrink-0 place-items-center',
        size === 'sm' && 'size-6 rounded-md',
        size === 'md' && 'size-8 rounded-lg',
        size === 'lg' && 'size-11 rounded-xl',
        TONES[tone],
        className,
      )}
    >
      <Icon
        name={icon}
        className={cx(
          size === 'sm' && 'size-3.5',
          size === 'md' && 'size-4.5',
          size === 'lg' && 'size-6',
        )}
      />
    </span>
  );
}

export function PlanMark({ className }: { readonly className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        'blueprint-grid relative inline-grid shrink-0 place-items-center overflow-hidden rounded-xl',
        className,
      )}
    >
      <svg viewBox="0 0 64 48" className="h-3/4 w-3/4">
        <rect
          x="6"
          y="6"
          width="52"
          height="36"
          fill="none"
          stroke="var(--color-plan-line)"
          strokeWidth="1.5"
        />
        <path
          d="M6 24h28"
          stroke="var(--color-plan-line)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M34 6v36"
          stroke="var(--color-change)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="36"
          className="animate-draw"
          style={{ ['--draw-length' as string]: '36' }}
        />
        <circle
          cx="34"
          cy="24"
          r="6"
          fill="none"
          stroke="var(--color-change)"
          strokeWidth="1"
          strokeDasharray="2 2"
          className="origin-[34px_24px] animate-[spin_8s_linear_infinite]"
        />
      </svg>
    </span>
  );
}

export function ChangedValue({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex animate-wave items-center rounded-md bg-blueprint px-2 py-0.5 font-mono text-sm font-medium text-change',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Meter({
  value,
  tone = 'accent',
  label,
}: {
  readonly value: number;
  readonly tone?: 'accent' | 'good' | 'critical' | 'warning';
  readonly label?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
      className="relative inline-block h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <span
        className={cx(
          'absolute inset-y-0 left-0 origin-left animate-grow rounded-full',
          tone === 'accent' && 'bg-accent',
          tone === 'good' && 'bg-good',
          tone === 'critical' && 'bg-critical',
          tone === 'warning' && 'bg-warning',
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </span>
  );
}
