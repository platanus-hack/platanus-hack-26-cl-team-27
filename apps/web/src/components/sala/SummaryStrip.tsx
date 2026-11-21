import { Icon, type IconName } from '@/components/common/Icon';
import type { BaselineTotals } from '@/lib/baseline-api';
import {
  formatCLP,
  formatDays,
  formatSignedCLP,
  formatSignedDays,
  plural,
} from '@/lib/format';
import type { RoomSnapshot } from '@/lib/room-api';

function Stat({
  icon,
  label,
  value,
  note,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly value: string;
  readonly note: string | null;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <Icon name={icon} className="mt-1 size-5 text-ink-3" />
      <div className="min-w-0">
        <p className="text-sm text-ink-2">{label}</p>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
            {value}
          </span>
          {note && (
            <span className="text-sm tabular-nums text-ink-2">{note}</span>
          )}
        </p>
      </div>
    </div>
  );
}

export function SummaryStrip({
  totals,
  version,
  counters,
}: {
  readonly totals: BaselineTotals;
  readonly version: number;
  readonly counters: RoomSnapshot['counters'];
}) {
  const ratio =
    counters.documents === 0
      ? 0
      : Math.min(1, counters.upToDate / counters.documents);
  const blockers = [
    counters.stale > 0 && plural(counters.stale, 'desfasado', 'desfasados'),
    counters.openDiscrepancies > 0 &&
      plural(
        counters.openDiscrepancies,
        'con discrepancia',
        'con discrepancia',
      ),
  ].filter(Boolean);
  return (
    <section
      aria-label="Resumen del proyecto"
      className="rounded-xl border border-hairline bg-surface"
    >
      <div className="grid divide-y divide-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat
          icon="coins"
          label="Costo del proyecto"
          value={formatCLP(totals.costTotal)}
          note={
            totals.costDelta === 0
              ? null
              : `${formatSignedCLP(totals.costDelta)} sobre el base`
          }
        />
        <Stat
          icon="calendar"
          label="Plazo"
          value={formatDays(totals.projectDays)}
          note={
            totals.delayDays === 0
              ? null
              : `${formatSignedDays(totals.delayDays)} sobre el base`
          }
        />
        <Stat
          icon="file"
          label="Versión del proyecto"
          value={`v${version}`}
          note={
            counters.openProposals > 0
              ? plural(
                  counters.openProposals,
                  'propuesta abierta',
                  'propuestas abiertas',
                )
              : null
          }
        />
      </div>
      <div className="border-t border-hairline px-5 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <p className="font-medium text-ink">
            {counters.upToDate} de {counters.documents} documentos al día
          </p>
          {blockers.length > 0 && (
            <p className="text-ink-2">{blockers.join(' · ')}</p>
          )}
        </div>
        <div
          role="progressbar"
          aria-label="Documentos al día"
          aria-valuemin={0}
          aria-valuemax={counters.documents}
          aria-valuenow={counters.upToDate}
          className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full rounded-full bg-good transition-[width] duration-700"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}
