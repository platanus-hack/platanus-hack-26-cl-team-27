import { Notice } from '@team27/ui';
import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

export function LoadError({ message }: { readonly message: string }) {
  return <Notice tone="error">{message}</Notice>;
}

export function Loading({ label = 'Cargando…' }: { readonly label?: string }) {
  return (
    <div role="status" className="flex flex-col gap-3 py-6">
      <p className="flex items-center justify-center gap-2 text-sm text-ink-2">
        <Icon name="spinner" className="animate-spin text-accent-text" />
        {label}
      </p>
      <div aria-hidden className="flex flex-col gap-2">
        <span className="skeleton h-4 w-2/3 rounded" />
        <span className="skeleton h-4 w-full rounded" />
        <span className="skeleton h-4 w-5/6 rounded" />
      </div>
    </div>
  );
}

export function Empty({
  children,
  icon,
}: {
  readonly children: ReactNode;
  readonly icon?: 'check';
}) {
  return (
    <p className="flex items-center gap-2 py-3 text-sm text-ink-2">
      {icon && (
        <Icon name={icon} filled className="size-5 animate-pop text-good" />
      )}
      {children}
    </p>
  );
}

export function EmptyPanel({
  title,
  children,
  icon = 'layers',
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly icon?: IconName;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center rounded-xl border border-dashed border-axis px-6 py-8 text-center"
    >
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent-soft/50 text-accent-text">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-2">{children}</p>
    </div>
  );
}
