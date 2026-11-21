import { Notice } from '@team27/ui';

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

export function Empty({ children }: { readonly children: React.ReactNode }) {
  return <p className="py-3 text-sm text-ink-2">{children}</p>;
}
