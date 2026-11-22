import type { Metadata } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { APP_NAME, APP_TAGLINE } from '@/lib/brand';

import './globals.css';

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

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
    <html lang="es-CL" className={plexMono.variable}>
      <body className="min-h-dvh bg-plane font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
