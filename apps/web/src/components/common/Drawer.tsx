'use client';

import { cx } from '@team27/ui';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Icon } from './Icon';

const WIDTH = {
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-2xl',
} as const;

export function Drawer({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  width = 'md',
}: {
  readonly title: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly width?: keyof typeof WIDTH;
}) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar"
        onClick={() => close.current()}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <aside
        ref={panel}
        tabIndex={-1}
        className={cx(
          'relative flex h-full w-full flex-col bg-plane shadow-2xl outline-none sm:border-l sm:border-hairline',
          WIDTH[width],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline bg-surface px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-xs text-ink-2">{eyebrow}</p>}
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => close.current()}
            aria-label="Cerrar"
            className="-mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Icon name="close" className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <footer className="border-t border-hairline bg-surface px-5 py-3">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
