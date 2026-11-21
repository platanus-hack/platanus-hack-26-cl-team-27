import Link from 'next/link';
import type { Route } from 'next';

import { Icon } from '@/components/common/Icon';
import type { InboxFiltered } from '@/lib/inbox-api';

export function FilteredCard({
  item,
  castId,
}: {
  readonly item: InboxFiltered;
  readonly castId: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2 text-base text-ink">
        <Icon name="ban" className="mt-1 size-5 text-ink-3" />
        <span>No te avisamos: {item.reason}</span>
      </p>
      <Link
        href={
          `/cambios/${item.changeId}?para=${encodeURIComponent(castId)}` as Route
        }
        className="text-sm font-medium text-accent-text hover:underline"
      >
        Ver por qué
      </Link>
    </div>
  );
}
