import { initials } from '@/components/common/initials';
import { formatClock } from '@/lib/format';

import type { ChannelViewProps } from './ChannelShell';

export function SlackFeed({ cast, items, empty }: ChannelViewProps) {
  return (
    <section aria-label="Hilo del canal" className="flex flex-col">
      <header className="bg-accent px-4 py-3 text-on-accent">
        <h2 className="text-base font-semibold">
          {cast.handle ?? '#los-aromos'}
        </h2>
        <p className="text-xs opacity-90">Hilo del equipo</p>
      </header>
      {items.length === 0 && <div className="px-4 py-6">{empty}</div>}
      <ul className="flex flex-col gap-1 bg-surface px-3 py-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 rounded-lg px-1 py-3">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-semibold text-ink"
            >
              {initials(item.from)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold text-ink">{item.from}</span>
                <time dateTime={item.at} className="text-xs text-ink-2">
                  {formatClock(item.at)}
                </time>
              </p>
              <h3 className="text-base font-semibold text-ink">
                {item.subject}
              </h3>
              <div className="mt-2">{item.body}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
