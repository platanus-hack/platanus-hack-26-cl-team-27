'use client';

import { cx } from '@team27/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon, type IconName } from '@/components/common/Icon';
import { buttonLink } from '@/components/common/link-styles';
import { useResource } from '@/hooks/use-resource';
import { loginHref } from '@/lib/account-routes';
import { getMe } from '@/lib/accounts-api';
import { navLinks, type NavLink } from '@/lib/nav';

export type NavMode = 'off' | 'guest' | 'member';

const NAV_ICON: Record<NavLink['href'], IconName> = {
  '/conectores': 'plug',
  '/admin': 'seal',
  '/cuenta': 'user',
};

function NavLinks({
  links,
  pathname,
}: {
  readonly links: readonly NavLink[];
  readonly pathname: string;
}) {
  return (
    <nav aria-label="Principal" className="flex h-full items-stretch gap-1">
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'group -mb-px flex items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors',
              active
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            <Icon
              name={NAV_ICON[link.href]}
              className={cx(
                'transition-transform duration-300 group-hover:-translate-y-0.5',
                active ? 'text-accent-text' : 'text-ink-3',
              )}
            />
            <span className="hidden sm:inline">{link.label}</span>
            <span className="sr-only sm:hidden">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MemberNav({ pathname }: { readonly pathname: string }) {
  const me = useResource(getMe, 'me');
  return <NavLinks links={navLinks(me.data)} pathname={pathname} />;
}

export function SiteNav({ mode }: { readonly mode: NavMode }) {
  const pathname = usePathname();
  if (mode === 'guest') {
    return (
      <nav aria-label="Principal" className="flex h-full items-center">
        <a
          href={loginHref(pathname === '/' ? '/cuenta' : pathname)}
          className={buttonLink('primary', 'sm')}
        >
          <Icon name="login" />
          Entrar
        </a>
      </nav>
    );
  }
  if (mode === 'member') return <MemberNav pathname={pathname} />;
  return <NavLinks links={navLinks(null)} pathname={pathname} />;
}
