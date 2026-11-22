import { BrandMark, BrandWordmark } from '@team27/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SiteNav, type NavMode } from '@/components/common/SiteNav';
import { auth0 } from '@/lib/auth0';
import { APP_TAGLINE } from '@/lib/brand';

const navMode = async (): Promise<NavMode> => {
  if (!auth0) return 'off';
  return (await auth0.getSession()) ? 'member' : 'guest';
};

export default async function SiteLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <>
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-stretch justify-between gap-4 px-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="Vigente, inicio"
          >
            <BrandMark className="size-7 text-accent-text" />
            <BrandWordmark className="h-5 w-auto text-ink" />
            <span className="hidden border-l border-hairline pl-2.5 text-xs text-ink-2 md:block">
              {APP_TAGLINE}
            </span>
          </Link>
          <SiteNav mode={await navMode()} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        {children}
      </main>
    </>
  );
}
