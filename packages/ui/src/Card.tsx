import type { ReactNode } from 'react';

import { cx } from './cx.ts';

export interface CardProps {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Card({
  title,
  description,
  actions,
  className,
  children,
}: CardProps) {
  return (
    <section
      className={cx(
        'rounded-xl border border-hairline bg-surface p-5',
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-ink">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-ink-2">{description}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
