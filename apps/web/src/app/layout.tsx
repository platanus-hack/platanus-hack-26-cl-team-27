import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { APP_NAME, APP_TAGLINE } from '@/lib/brand';

import './globals.css';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: `${APP_NAME} · ${APP_TAGLINE}`,
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="es-CL">
      <body className="min-h-dvh bg-plane font-sans text-ink antialiased">
        <header className="border-b border-hairline bg-surface">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-8">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-semibold text-on-accent"
            >
              27
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">
                {APP_NAME}
              </span>
              <span className="block text-xs text-ink-2">{APP_TAGLINE}</span>
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
