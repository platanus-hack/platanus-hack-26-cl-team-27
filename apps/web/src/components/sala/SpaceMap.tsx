import { cx } from '@team27/ui';
import { useState } from 'react';

import type { RoomSpace, SpaceKind } from '@/lib/room-api';

const KIND_LABEL: Record<SpaceKind, string> = {
  drive: 'Carpeta de planos',
  sharepoint: 'Carpeta de costos',
  email: 'Correo',
  whatsapp: 'Chat de obra',
  libro_obra: 'Libro de obra',
};

function SpaceTile({ space }: { readonly space: RoomSpace }) {
  const [initial] = useState(space.revisions);
  const changed = space.revisions !== initial;
  return (
    <li
      className={cx(
        'relative rounded-xl border border-hairline bg-surface-2 p-4',
        changed && 'border-accent',
      )}
    >
      {changed && (
        <span
          key={space.revisions}
          aria-hidden
          className="pulse-once pointer-events-none absolute inset-0 rounded-xl border-4 border-accent"
        />
      )}
      <p className="text-lg text-ink-2">{KIND_LABEL[space.kind]}</p>
      <p className="text-xl font-semibold text-ink">{space.name}</p>
      <p className="mt-1 text-lg text-ink-2">
        {space.documents} documentos · {space.revisions} revisiones
      </p>
      <p className="mt-1 text-lg text-ink">
        {space.members.map((member) => member.name).join(', ') ||
          space.ownerName}
      </p>
    </li>
  );
}

export function SpaceMap({
  spaces,
}: {
  readonly spaces: readonly RoomSpace[];
}) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <h2 className="text-2xl font-semibold text-ink">
        Dónde vive la información
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {spaces.map((space) => (
          <SpaceTile key={space.id} space={space} />
        ))}
      </ul>
    </section>
  );
}
