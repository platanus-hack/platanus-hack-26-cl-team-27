import type { ReactNode } from 'react';

import { cx } from './cx.ts';

const TONES = {
  info: { mark: 'bg-accent', label: 'Aviso' },
  success: { mark: 'bg-good', label: 'Listo' },
  error: { mark: 'bg-critical', label: 'Error' },
} as const;

export interface NoticeProps {
  readonly tone?: keyof typeof TONES;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Notice({ tone = 'info', className, children }: NoticeProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-3 rounded-lg border border-hairline bg-surface-2 px-3 py-2.5 text-sm text-ink',
        className,
      )}
    >
      <span
        aria-hidden
        className={cx('mt-1.5 size-2 shrink-0 rounded-full', TONES[tone].mark)}
      />
      <span>
        <span className="sr-only">{TONES[tone].label}: </span>
        {children}
      </span>
    </div>
  );
}
