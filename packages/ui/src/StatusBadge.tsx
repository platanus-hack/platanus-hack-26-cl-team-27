import { cx } from './cx.ts';

const TONES = {
  good: { color: 'text-good', path: 'M3.5 8.5 6.5 11.5 12.5 4.5' },
  serious: { color: 'text-serious', path: 'M4 8h8' },
  neutral: { color: 'text-ink-3', path: 'M5 8h6' },
} as const;

export interface StatusBadgeProps {
  readonly tone: keyof typeof TONES;
  readonly label: string;
  readonly className?: string;
}

export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 text-sm text-ink-2',
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className={cx('size-4', TONES[tone].color)}
      >
        <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.16" />
        <path
          d={TONES[tone].path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}
