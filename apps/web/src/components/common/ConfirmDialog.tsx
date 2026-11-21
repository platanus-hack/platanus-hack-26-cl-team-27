'use client';

import { Button, Notice } from '@team27/ui';
import { useEffect, useId, useRef, type ReactNode } from 'react';

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly busyLabel: string;
  readonly busy: boolean;
  readonly error?: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const cancel = useRef(onCancel);
  const titleId = useId();

  useEffect(() => {
    cancel.current = onCancel;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      cancel.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 grid place-items-end p-4 sm:place-items-center"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cancelar"
        onClick={() => cancel.current()}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <div className="relative w-full max-w-md rounded-xl border border-hairline bg-surface p-5 shadow-2xl">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-2 text-sm text-ink-2">{children}</div>
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            autoFocus
            variant="secondary"
            disabled={busy}
            onClick={() => cancel.current()}
          >
            Cancelar
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
