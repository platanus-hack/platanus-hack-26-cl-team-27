'use client';

import { cx } from '@team27/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { buttonLink } from '@/components/common/link-styles';
import { loginHref } from '@/lib/account-routes';

export type NavMode = 'off' | 'guest' | 'member';

const MEMBER_LINKS = [
  { href: '/modelos', label: 'Modelos' },
  { href: '/conectores', label: 'Conectores' },
  { href: '/cuenta', label: 'Cuenta' },
] as const;

const OFF_LINKS = [{ href: '/cuenta', label: 'Cuenta' }] as const;

export function SiteNav({ mode }: { readonly mode: NavMode }) {
  const pathname = usePathname();
  if (mode === 'guest') {
    return (
      <nav aria-label="Principal" className="flex h-full items-center">
        <a
          href={loginHref(pathname === '/' ? '/cuenta' : pathname)}
          className={buttonLink('primary', 'sm')}
        >
          Entrar
        </a>
      </nav>
    );
  }
  const links = mode === 'member' ? MEMBER_LINKS : OFF_LINKS;
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
              '-mb-px flex items-center border-b-2 px-3 text-sm font-medium transition-colors',
              active
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
