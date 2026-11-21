import { cx } from '@team27/ui';

import { ValueStatusChip } from '@/components/common/status';
import { groupBySection, type BaselineEntry } from '@/lib/baseline-api';
import { formatValue, plural } from '@/lib/format';

import type { ValueRef } from './ProvenanceDrawer';

const sourcesText = (entry: BaselineEntry): string =>
  `${plural(entry.sources, 'fuente', 'fuentes')}${
    entry.staleCount > 0
      ? ` · ${plural(entry.staleCount, 'desfase', 'desfases')}`
      : ''
  }`;

export function ValueTable({
  entries,
  onSelect,
}: {
  readonly entries: readonly BaselineEntry[];
  readonly onSelect: (ref: ValueRef) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <table className="w-full">
        <thead>
          <tr className="border-b border-hairline text-left text-xs font-medium text-ink-2">
            <th scope="col" className="px-4 py-2 font-medium">
              Elemento
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Valor vigente
            </th>
            <th
              scope="col"
              className="hidden px-4 py-2 font-medium sm:table-cell"
            >
              Estado
            </th>
            <th
              scope="col"
              className="hidden px-4 py-2 font-medium md:table-cell"
            >
              Fuentes
            </th>
          </tr>
        </thead>
        {groupBySection(entries).map((group) => (
          <tbody key={group.id}>
            <tr>
              <th
                scope="colgroup"
                colSpan={4}
                className="bg-surface-2/70 px-4 py-1.5 text-left text-xs font-semibold text-ink-2"
              >
                {group.label}
              </th>
            </tr>
            {group.entries.map((entry) => (
              <tr
                key={`${entry.subjectId}/${entry.attribute}`}
                className={cx(
                  'relative border-t border-hairline transition-colors hover:bg-surface-2/60',
                  entry.status === 'disputed' && 'bg-critical/6',
                )}
              >
                <td className="px-4 py-2 align-top">
                  <button
                    type="button"
                    onClick={() => onSelect(entry)}
                    className="text-left text-ink after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <span className="font-medium">{entry.subjectName}</span>{' '}
                    <span className="text-ink-2">· {entry.label}</span>
                  </button>
                  <span className="block text-xs text-ink-2 md:hidden">
                    {sourcesText(entry)}
                  </span>
                </td>
                <td className="px-4 py-2 align-top whitespace-nowrap">
                  <span className="text-lg font-semibold tabular-nums text-ink">
                    {formatValue(entry.value, entry.unit)}
                  </span>
                  {entry.proposedValue !== null && (
                    <span className="block text-sm tabular-nums text-ink-2">
                      Propuesta: {formatValue(entry.proposedValue, entry.unit)}
                    </span>
                  )}
                  <span className="mt-1 block sm:hidden">
                    <ValueStatusChip status={entry.status} />
                  </span>
                </td>
                <td className="hidden px-4 py-2 align-top sm:table-cell">
                  <ValueStatusChip status={entry.status} />
                </td>
                <td className="hidden px-4 py-2 align-top text-sm text-ink-2 md:table-cell">
                  {sourcesText(entry)}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
