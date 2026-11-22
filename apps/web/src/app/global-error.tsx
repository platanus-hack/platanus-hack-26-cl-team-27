'use client';

import { RouteError } from '@/components/common/RouteError';

import './globals.css';

export default function GlobalError({
  error,
  retry,
}: {
  readonly error: unknown;
  readonly retry: () => void;
}) {
  return (
    <html lang="es-CL">
      <body className="min-h-dvh bg-plane font-sans text-ink antialiased">
        <RouteError error={error} retry={retry} />
      </body>
    </html>
  );
}
