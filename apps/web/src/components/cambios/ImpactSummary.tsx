import { CostDelay } from '@/components/common/CostDelay';
import { formatCLP, formatDays, formatSignedCLP, plural } from '@/lib/format';
import type { ImpactView } from '@/lib/changes-api';

export function ImpactSummary({ impact }: { readonly impact: ImpactView }) {
  const lines = impact.costLines.filter((line) => line.delta !== 0);
  const critical = impact.tasks.filter(
    (task) => task.daysAfter !== task.daysBefore,
  );
  return (
    <div className="flex flex-col gap-4">
      <CostDelay
        costDelta={impact.costDelta}
        delayDays={impact.delayDays}
        large
      />
      <p className="text-sm text-ink-2">
        Entrega: {formatDays(impact.projectDaysBefore)} antes,{' '}
        {formatDays(impact.projectDaysAfter)} después.
      </p>
      {lines.length > 0 && (
        <table className="w-full text-sm">
          <caption className="mb-1 text-left font-medium text-ink">
            Partidas que cambian
          </caption>
          <tbody>
            {lines.map((line) => (
              <tr key={line.code} className="border-t border-hairline">
                <td className="py-1.5 pr-3 text-ink">
                  {line.code} {line.name}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink-2">
                  {plural(line.after - line.before, line.unit, line.unit)} a{' '}
                  {formatCLP(line.unitPrice)}
                </td>
                <td className="py-1.5 text-right font-semibold tabular-nums text-ink">
                  {formatSignedCLP(line.delta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {critical.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {critical.map((task) => (
            <li key={task.id} className="text-ink">
              {task.name}: {formatDays(task.daysBefore)} a{' '}
              {formatDays(task.daysAfter)},{' '}
              {task.critical
                ? 'en la ruta crítica'
                : `fuera de la ruta crítica, con ${formatDays(task.floatDays)} de holgura`}
              .
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
