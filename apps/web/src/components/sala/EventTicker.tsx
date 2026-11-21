import { Icon, type IconName } from '@/components/common/Icon';
import { formatClock } from '@/lib/format';
import type { RoomEvent } from '@/lib/events-api';

const ICONS: Record<string, IconName> = {
  revision: 'upload',
  proposal: 'file',
  vote: 'check',
  merge: 'seal',
  discrepancy: 'alert',
  stale: 'hourglass',
  seat: 'user',
  seal: 'seal',
};

export function EventTicker({
  events,
  limit = 8,
}: {
  readonly events: readonly RoomEvent[];
  readonly limit?: number;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <h2 className="text-2xl font-semibold text-ink">Lo que está pasando</h2>
      {events.length === 0 ? (
        <p className="mt-3 text-xl text-ink-2">
          Esperando el primer movimiento.
        </p>
      ) : (
        <ol aria-live="polite" className="mt-3 flex flex-col gap-2.5">
          {events.slice(0, limit).map((event) => (
            <li
              key={event.seq}
              className="flex items-start gap-3 text-xl text-ink"
            >
              <Icon
                name={ICONS[event.kind] ?? 'bell'}
                className="mt-1.5 size-5 text-accent-text"
              />
              <span className="min-w-0 flex-1">{event.message}</span>
              <time
                dateTime={event.at}
                className="text-lg tabular-nums text-ink-2"
              >
                {formatClock(event.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
