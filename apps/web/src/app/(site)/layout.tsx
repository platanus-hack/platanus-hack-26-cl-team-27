import { BrandMark, BrandWordmark } from '@team27/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { APP_TAGLINE } from '@/lib/brand';

export default function SiteLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <>
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark className="size-8 text-accent-text" />
            <span className="flex flex-col gap-1">
              <BrandWordmark className="h-5 w-auto text-ink" />
              <span className="block text-xs text-ink-2">{APP_TAGLINE}</span>
            </span>
          </Link>
          <nav
            aria-label="Principal"
            className="flex gap-4 text-sm font-medium text-accent-text"
          >
            <Link href="/sala" className="hover:underline">
              Sala
            </Link>
            <Link href="/espacios" className="hover:underline">
              Espacios
            </Link>
            <Link href="/presentador" className="hover:underline">
              Presentador
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        {children}
      </main>
    </>
  );
}
