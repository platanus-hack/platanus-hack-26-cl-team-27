import { cx } from '@team27/ui';

import type { SpaceView } from '@/lib/spaces-api';

export function SpaceTabs({
  spaces,
  activeId,
  onChange,
}: {
  readonly spaces: readonly SpaceView[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Espacios" className="flex flex-wrap gap-2">
      {spaces.map((space) => (
        <button
          key={space.id}
          type="button"
          role="tab"
          aria-selected={space.id === activeId}
          onClick={() => onChange(space.id)}
          className={cx(
            'rounded-lg border px-3 py-2 text-sm font-medium',
            space.id === activeId
              ? 'border-accent bg-accent-soft/30 text-ink'
              : 'border-hairline bg-surface text-ink-2 hover:bg-surface-2',
          )}
        >
          {space.name}
        </button>
      ))}
    </div>
  );
}
