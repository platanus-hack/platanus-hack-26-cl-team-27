import { cx } from '@team27/ui';
import { useState } from 'react';

import { Icon } from '@/components/common/Icon';
import { SPACE_ICON } from '@/components/common/space-icon';
import { plural } from '@/lib/format';
import type { RoomSpace } from '@/lib/room-api';

function SpaceRow({ space }: { readonly space: RoomSpace }) {
  const [initial] = useState(space.revisions);
  const received = space.revisions !== initial;
  return (
    <li className="relative flex items-center gap-3 rounded-lg px-2 py-1.5">
      {received && (
        <span
          key={space.revisions}
          aria-hidden
          className="pulse-once pointer-events-none absolute inset-0 rounded-lg border-2 border-accent"
        />
      )}
      <Icon name={SPACE_ICON[space.kind]} className="size-5 text-ink-2" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{space.name}</p>
        <p className="truncate text-xs text-ink-2">
          {space.ownerName} ·{' '}
          {plural(space.revisions, 'revisión', 'revisiones')}
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
        <span
          aria-hidden
          className={cx(
            'size-2 rounded-full bg-good',
            received && 'animate-pulse',
          )}
        />
        Conectado
      </span>
    </li>
  );
}

export function SpaceList({
  spaces,
}: {
  readonly spaces: readonly RoomSpace[];
}) {
  return (
    <ul className="-mx-2 flex flex-col">
      {spaces.map((space) => (
        <SpaceRow key={space.id} space={space} />
      ))}
    </ul>
  );
}
