'use client';

import { cx } from '@team27/ui';
import { useEffect, useRef, useState } from 'react';

import { Icon } from './Icon';

export interface MenuAction {
  readonly label: string;
  readonly onSelect: () => void;
  readonly danger?: boolean;
  readonly disabled?: boolean;
}

export function ActionMenu({
  actions,
  label = 'Más acciones',
}: {
  readonly actions: readonly MenuAction[];
  readonly label?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Icon name="dots" className="size-5" />
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-52 rounded-lg border border-hairline bg-surface p-1 shadow-lg"
        >
          {actions.map((action) => (
            <li key={action.label} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                className={cx(
                  'w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50',
                  action.danger ? 'text-critical-text' : 'text-ink',
                )}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
