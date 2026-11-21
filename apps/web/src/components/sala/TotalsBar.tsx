import type { BaselineTotals } from '@/lib/baseline-api';
import {
  formatCLP,
  formatDays,
  formatSignedCLP,
  formatSignedDays,
} from '@/lib/format';

function Stat({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xl text-ink-2">{label}</p>
      <p className="text-5xl font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
      {note && <p className="mt-1 text-xl text-ink-2">{note}</p>}
    </div>
  );
}

export function TotalsBar({
  totals,
  version,
}: {
  readonly totals: BaselineTotals;
  readonly version: number;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <Stat
        label="Costo del proyecto"
        value={formatCLP(totals.costTotal)}
        note={
          totals.costDelta === 0
            ? null
            : `${formatSignedCLP(totals.costDelta)} sobre el base`
        }
      />
      <Stat
        label="Plazo"
        value={formatDays(totals.projectDays)}
        note={
          totals.delayDays === 0
            ? null
            : `${formatSignedDays(totals.delayDays)} sobre el base`
        }
      />
      <Stat label="Versión del proyecto" value={`v${version}`} />
    </div>
  );
}
