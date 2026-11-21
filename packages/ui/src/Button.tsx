import type { ButtonHTMLAttributes } from 'react';

import { cx } from './cx.ts';

const VARIANTS = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong',
  secondary: 'border border-hairline bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger:
    'border border-critical/50 bg-surface text-critical-text hover:bg-critical/10',
  critical: 'bg-critical text-white hover:bg-critical/90',
} as const;

const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: keyof typeof VARIANTS;
  readonly size?: keyof typeof SIZES;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
