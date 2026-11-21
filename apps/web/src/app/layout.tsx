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
        {children}
      </body>
    </html>
  );
}
