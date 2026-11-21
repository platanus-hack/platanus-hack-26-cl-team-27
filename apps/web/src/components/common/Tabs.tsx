import { cx } from '@team27/ui';

export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly count?: number;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
  className,
}: {
  readonly tabs: readonly TabItem<T>[];
  readonly active: T;
  readonly onChange: (id: T) => void;
  readonly label: string;
  readonly className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx('flex gap-1 border-b border-hairline', className)}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cx(
              '-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
              selected
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cx(
                  'min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums',
                  selected ? 'bg-ink text-plane' : 'bg-surface-2 text-ink-2',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
