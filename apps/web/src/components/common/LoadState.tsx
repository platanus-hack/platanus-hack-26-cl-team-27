import { Notice } from '@team27/ui';
import type { ReactNode } from 'react';

import { Icon } from './Icon';

export function LoadError({ message }: { readonly message: string }) {
  return <Notice tone="error">{message}</Notice>;
}

export function Loading({ label = 'Cargando…' }: { readonly label?: string }) {
  return (
    <p role="status" className="py-8 text-center text-sm text-ink-2">
      {label}
    </p>
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
      {icon && <Icon name={icon} filled className="size-5 text-good" />}
      {children}
    </p>
  );
}

export function EmptyPanel({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      role="status"
      className="rounded-xl border border-dashed border-axis px-6 py-8 text-center"
    >
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-2">{children}</p>
    </div>
  );
}
