import { cx } from './cx.ts';
import { formatCount } from './StatTile.tsx';

export interface Column {
  readonly key: string;
  readonly axisLabel: string;
  readonly longLabel: string;
  readonly value: number;
}

export interface ColumnChartProps {
  readonly title: string;
  readonly description?: string;
  readonly columns: readonly Column[];
  readonly unit: (value: number) => string;
  readonly tableHeaders: readonly [string, string];
  readonly className?: string;
}

const PLOT_HEIGHT = 160;

const niceTicks = (max: number): readonly number[] => {
  if (max <= 0) {
    return [0, 1];
  }
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10]
      .map((factor) => factor * magnitude)
      .find((candidate) => candidate >= rough) ?? magnitude * 10;
  const wholeStep = Math.max(1, Math.round(step));
  const top = Math.ceil(max / wholeStep) * wholeStep;
  return Array.from(
    { length: top / wholeStep + 1 },
    (_, index) => index * wholeStep,
  );
};

export function ColumnChart({
  title,
  description,
  columns,
  unit,
  tableHeaders,
  className,
}: ColumnChartProps) {
  const max = Math.max(0, ...columns.map((column) => column.value));
  const ticks = niceTicks(max);
  const top = ticks.at(-1) ?? 1;
  const lastIndex = columns.length - 1;
  const peakIndex =
    max > 0 ? columns.findIndex((column) => column.value === max) : -1;
  return (
    <figure className={cx('flex flex-col gap-4', className)}>
      <figcaption>
        <span className="block text-base font-semibold text-ink">{title}</span>
        {description && (
          <span className="mt-1 block text-sm text-ink-2">{description}</span>
        )}
      </figcaption>
      <div className="mt-6 flex gap-2">
        <div
          aria-hidden
          className="relative w-6 shrink-0 text-right text-xs tabular-nums text-ink-3"
          style={{ height: PLOT_HEIGHT }}
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              {formatCount(tick)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: PLOT_HEIGHT }}>
            {ticks.map((tick) => (
              <span
                key={tick}
                aria-hidden
                className={cx(
                  'absolute inset-x-0 h-px',
                  tick === 0 ? 'bg-axis' : 'bg-grid',
                )}
                style={{ bottom: `${(tick / top) * 100}%` }}
              />
            ))}
            <ul className="absolute inset-0 flex">
              {columns.map((column, index) => {
                const labelled = index === lastIndex || index === peakIndex;
                const align =
                  index < columns.length / 3
                    ? 'left-0'
                    : index >= (columns.length * 2) / 3
                      ? 'right-0'
                      : 'left-1/2 -translate-x-1/2';
                return (
                  <li
                    key={column.key}
                    tabIndex={0}
                    aria-label={`${column.longLabel}: ${unit(column.value)}`}
                    className="group relative flex h-full flex-1 items-end justify-center outline-none"
                  >
                    <span
                      className="relative w-full max-w-6 rounded-t bg-series-1 transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80 mx-px"
                      style={{ height: `${(column.value / top) * 100}%` }}
                    >
                      {labelled && column.value > 0 && (
                        <span
                          aria-hidden
                          className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium text-ink"
                        >
                          {formatCount(column.value)}
                        </span>
                      )}
                    </span>
                    <span
                      role="tooltip"
                      className={cx(
                        'pointer-events-none invisible absolute bottom-full z-10 mb-2 w-max rounded-lg border border-hairline bg-surface px-3 py-2 text-left shadow-sm group-hover:visible group-focus-visible:visible',
                        align,
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <span
                          aria-hidden
                          className="h-0.5 w-3 rounded-full bg-series-1"
                        />
                        {unit(column.value)}
                      </span>
                      <span className="block text-xs text-ink-2">
                        {column.longLabel}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <ol aria-hidden className="mt-2 flex text-xs text-ink-3">
            {columns.map((column, index) => (
              <li key={column.key} className="flex-1 text-center">
                {index % 2 === lastIndex % 2 ? column.axisLabel : ''}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-2 hover:text-ink">
          Ver como tabla
        </summary>
        <table className="mt-3 w-full text-left">
          <thead className="text-ink-2">
            <tr>
              <th className="py-1 font-medium">{tableHeaders[0]}</th>
              <th className="py-1 text-right font-medium">{tableHeaders[1]}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-ink">
            {columns.map((column) => (
              <tr key={column.key} className="border-t border-hairline">
                <td className="py-1">{column.longLabel}</td>
                <td className="py-1 text-right">{formatCount(column.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
