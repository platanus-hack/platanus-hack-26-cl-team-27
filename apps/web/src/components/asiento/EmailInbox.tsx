import { formatClock } from '@/lib/format';

import type { ChannelViewProps } from './ChannelShell';

export function EmailInbox({ cast, items, empty }: ChannelViewProps) {
  return (
    <section aria-label="Bandeja de entrada" className="flex flex-col">
      <header className="border-b border-hairline bg-surface px-4 py-3">
        <h2 className="text-base font-semibold text-ink">Bandeja de entrada</h2>
        <p className="text-sm text-ink-2">{cast.handle ?? cast.name}</p>
      </header>
      {items.length === 0 && <div className="px-4 py-6">{empty}</div>}
      <ul className="flex flex-col divide-y divide-hairline">
        {items.map((item) => (
          <li key={item.id} className="bg-surface px-4 py-4">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span
                className={
                  item.unread ? 'font-semibold text-ink' : 'text-ink-2'
                }
              >
                {item.from}
              </span>
              <time dateTime={item.at} className="shrink-0 text-ink-2">
                {formatClock(item.at)}
              </time>
            </div>
            <h3 className="mt-0.5 text-base font-semibold text-ink">
              {item.subject}
            </h3>
            <div className="mt-3">{item.body}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
