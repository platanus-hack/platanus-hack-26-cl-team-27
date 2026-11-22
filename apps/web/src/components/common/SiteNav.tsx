'use client';

import { cx } from '@team27/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/sala', label: 'Sala' },
  { href: '/espacios', label: 'Espacios' },
  { href: '/modelos', label: 'Modelos' },
  { href: '/conectores', label: 'Conectores' },
  { href: '/presentador', label: 'Presentador' },
  { href: '/cuenta', label: 'Cuenta' },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex h-full items-stretch gap-1">
      {LINKS.map((link) => {
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
