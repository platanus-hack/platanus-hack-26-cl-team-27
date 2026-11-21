import { cx } from '@team27/ui';

import { ValueStatusMark } from '@/components/common/status';
import { groupBySection, type BaselineEntry } from '@/lib/baseline-api';
import { formatValue, plural } from '@/lib/format';

export interface ValueRef {
  readonly subjectId: string;
  readonly attribute: string;
}

function Row({
  entry,
  onSelect,
}: {
  readonly entry: BaselineEntry;
  readonly onSelect: (ref: ValueRef) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(entry)}
        className={cx(
          'grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-lg px-3 py-3 text-left transition-colors hover:bg-surface-2',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
          entry.status === 'disputed' && 'bg-critical/10',
        )}
      >
        <span className="min-w-0 text-xl text-ink">
          {entry.subjectName}
          <span className="text-ink-2"> · {entry.label}</span>
        </span>
        <span className="text-right text-3xl font-semibold tabular-nums text-ink">
          {formatValue(entry.value, entry.unit)}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <ValueStatusMark status={entry.status} large />
          {entry.proposedValue !== null && (
            <span className="text-lg text-ink">
              Propuesta: {formatValue(entry.proposedValue, entry.unit)}
            </span>
          )}
        </span>
        <span className="text-right text-lg text-ink-2">
          {plural(entry.sources, 'fuente', 'fuentes')}
          {entry.staleCount > 0 &&
            ` · ${plural(entry.staleCount, 'desfase', 'desfases')}`}
        </span>
      </button>
    </li>
  );
}

export function BaselineBoard({
  entries,
  onSelect,
}: {
  readonly entries: readonly BaselineEntry[];
  readonly onSelect: (ref: ValueRef) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {groupBySection(entries).map((group) => (
        <section
          key={group.id}
          className="rounded-xl border border-hairline bg-surface p-4"
        >
          <h2 className="mb-2 px-3 text-2xl font-semibold text-ink">
            {group.label}
          </h2>
          <ul className="flex flex-col divide-y divide-hairline">
            {group.entries.map((entry) => (
              <Row
                key={`${entry.subjectId}/${entry.attribute}`}
                entry={entry}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
