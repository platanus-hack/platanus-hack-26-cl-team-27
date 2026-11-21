import { RelativeTime } from '@/components/common/RelativeTime';
import type { RoomEvent } from '@/lib/events-api';

export function ActivityFeed({
  events,
  limit = 6,
}: {
  readonly events: readonly RoomEvent[];
  readonly limit?: number;
}) {
  if (events.length === 0)
    return (
      <p className="text-sm text-ink-2">Esperando el primer movimiento.</p>
    );
  return (
    <ol aria-live="polite" className="ml-1 border-l border-hairline">
      {events.slice(0, limit).map((event) => (
        <li key={event.seq} className="relative pb-3 pl-4 last:pb-0">
          <span
            aria-hidden
            className="absolute top-1.5 -left-[4.5px] size-2 rounded-full bg-axis"
          />
          <RelativeTime at={event.at} className="block text-xs text-ink-2" />
          <p className="text-sm text-ink">{event.message}</p>
        </li>
      ))}
    </ol>
  );
}
