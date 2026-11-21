import { cx } from '@team27/ui';

const VARIANTS = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong',
  secondary: 'border border-hairline bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
} as const;

const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
} as const;

export const buttonLink = (
  variant: keyof typeof VARIANTS = 'secondary',
  size: keyof typeof SIZES = 'md',
  className?: string,
): string =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    VARIANTS[variant],
    SIZES[size],
    className,
  );

export const textLink =
  'inline-flex items-center gap-1 font-medium text-accent-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent';
