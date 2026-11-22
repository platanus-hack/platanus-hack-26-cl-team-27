'use client';

import { Button } from '@team27/ui';
import Link from 'next/link';

import { errorDigest } from '@/lib/route-error';

export function RouteError({
  error,
  retry,
}: {
  readonly error: unknown;
  readonly retry: () => void;
}) {
  const digest = errorDigest(error);
  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col items-center justify-center gap-3 px-4 py-12 text-center"
    >
      <h1 className="text-2xl font-semibold text-ink">
        Algo no salió como esperábamos
      </h1>
      <p className="text-base text-ink-2">
        Esta pantalla tuvo un problema. Intenta de nuevo; si sigue igual, vuelve
        al inicio.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => retry()}>Reintentar</Button>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-lg border border-hairline bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2"
        >
          Volver al inicio
        </Link>
      </div>
      {digest && (
        <p className="mt-4 max-w-full break-all text-xs text-ink-2">
          Código: {digest}
        </p>
      )}
    </div>
  );
}
