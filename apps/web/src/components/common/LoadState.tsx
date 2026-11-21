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

export function WaitingForLake({
  children = 'Los documentos llegan por el ETL: pnpm etl.',
}: {
  readonly children?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className="rounded-xl border border-hairline bg-surface p-8 text-center"
    >
      <p className="text-xl font-semibold text-ink">
        Esperando la carga inicial
      </p>
      <p className="mt-2 text-base text-ink-2">{children}</p>
    </div>
  );
}
