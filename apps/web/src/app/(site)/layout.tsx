import { BrandMark, BrandWordmark } from '@team27/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { HeaderTools } from '@/components/common/HeaderTools';
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
  const mode = await navMode();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-hairline bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-stretch justify-between gap-4 px-4 sm:px-8">
          <Link
            href="/"
            className="group flex items-center gap-2.5"
            aria-label="Vigente, inicio"
          >
            <BrandMark className="size-7 text-accent-text transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" />
            <BrandWordmark className="h-5 w-auto text-ink" />
            <span className="hidden border-l border-hairline pl-2.5 text-xs text-ink-2 md:block">
              {APP_TAGLINE}
            </span>
          </Link>
          <div className="flex items-stretch gap-3">
            <SiteNav mode={mode} />
            {mode === 'member' && <HeaderTools />}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        {children}
      </main>
    </>
  );
}
