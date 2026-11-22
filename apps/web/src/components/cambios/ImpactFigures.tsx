import { cx } from '@team27/ui';

import { costText } from '@/components/common/CostDelay';
import { Icon } from '@/components/common/Icon';
import type { CostLine, TaskImpact } from '@/lib/changes-api';
import {
  formatCLP,
  formatDays,
  formatNumber,
  formatSignedDays,
  MINUS,
} from '@/lib/format';

export const td = 'py-2 pr-3 align-top text-sm text-ink';

const figure =
  'rounded-lg border border-hairline bg-surface p-3 transition-transform hover:-translate-y-0.5';
const figureLabel = 'flex items-center gap-1.5 text-xs text-ink-2';
const figureValue =
  'mt-1 font-mono text-base font-semibold tabular-nums text-ink sm:text-lg';

const signed = (value: number): string =>
  value === 0
    ? '0'
    : `${value > 0 ? '+' : MINUS}${formatNumber(Math.abs(value))}`;

export interface ImpactNumbers {
  readonly costDelta: number;
  readonly delayDays: number;
  readonly projectDaysBefore: number;
  readonly projectDaysAfter: number;
  readonly costLines: readonly CostLine[];
  readonly tasks: readonly TaskImpact[];
}

export function ImpactFigures({ impact }: { readonly impact: ImpactNumbers }) {
  const costLines = impact.costLines.filter((line) => line.delta !== 0);
  const tasks = impact.tasks.filter(
    (task) => task.daysAfter !== task.daysBefore,
  );

  return (
    <>
      <dl className="stagger grid grid-cols-3 gap-3">
        <div className={figure}>
          <dt className={figureLabel}>
            <Icon name="coins" className="text-accent-text" />
            Costo
          </dt>
          <dd className={figureValue}>{costText(impact.costDelta)}</dd>
        </div>
        <div className={figure}>
          <dt className={figureLabel}>
            <Icon name="calendar" className="text-accent-text" />
            Plazo
          </dt>
          <dd className={figureValue}>{formatSignedDays(impact.delayDays)}</dd>
        </div>
        <div className={figure}>
          <dt className={figureLabel}>
            <Icon name="flag" className="text-accent-text" />
            Entrega
          </dt>
          <dd className={figureValue}>
            {impact.projectDaysBefore === impact.projectDaysAfter
              ? formatDays(impact.projectDaysAfter)
              : `${impact.projectDaysBefore} → ${formatDays(impact.projectDaysAfter)}`}
          </dd>
        </div>
      </dl>

      {costLines.length > 0 && (
        <table className="mt-4 w-full">
          <caption className="mb-1 text-left text-xs font-medium text-ink-2">
            Partidas que cambian
          </caption>
          <thead className="sr-only">
            <tr>
              <th>Partida</th>
              <th>Cantidad</th>
              <th>Variación</th>
            </tr>
          </thead>
          <tbody>
            {costLines.map((line) => (
              <tr key={line.code} className="border-t border-hairline">
                <td className={td}>
                  <span className="tabular-nums text-ink-2">{line.code}</span>{' '}
                  {line.name}
                  <span className="block text-xs tabular-nums text-ink-2 sm:hidden">
                    {signed(line.after - line.before)} {line.unit} a{' '}
                    {formatCLP(line.unitPrice)}
                  </span>
                </td>
                <td
                  className={cx(
                    td,
                    'hidden text-right whitespace-nowrap tabular-nums text-ink-2 sm:table-cell',
                  )}
                >
                  {signed(line.after - line.before)} {line.unit} a{' '}
                  {formatCLP(line.unitPrice)}
                </td>
                <td
                  className={cx(
                    td,
                    'pr-0 text-right font-semibold whitespace-nowrap tabular-nums',
                  )}
                >
                  {costText(line.delta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tasks.length > 0 && (
        <table className="mt-4 w-full">
          <caption className="mb-1 text-left text-xs font-medium text-ink-2">
            Tareas afectadas
          </caption>
          <thead className="sr-only">
            <tr>
              <th>Tarea</th>
              <th>Duración</th>
              <th>Ruta crítica</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-t border-hairline">
                <td className={td}>{task.name}</td>
                <td
                  className={cx(
                    td,
                    'whitespace-nowrap tabular-nums text-ink-2',
                  )}
                >
                  {formatDays(task.daysBefore)} → {formatDays(task.daysAfter)}
                </td>
                <td className={cx(td, 'pr-0 text-right text-ink-2')}>
                  {task.critical ? (
                    <span className="inline-flex items-center gap-1 font-medium text-critical-text">
                      <Icon name="route" />
                      En la ruta crítica
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="clock" className="text-ink-3" />
                      Holgura de {formatDays(task.floatDays)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
