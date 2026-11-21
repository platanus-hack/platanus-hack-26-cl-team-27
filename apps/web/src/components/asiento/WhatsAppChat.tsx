import { formatClock } from '@/lib/format';

import type { ChannelViewProps } from './ChannelShell';

export function WhatsAppChat({ cast, items, empty }: ChannelViewProps) {
  return (
    <section aria-label="Chat de la obra" className="flex flex-col bg-good/10">
      <header className="flex items-center gap-3 bg-surface-2 px-4 py-3">
        <span
          aria-hidden
          className="grid size-9 place-items-center rounded-full bg-good text-sm font-semibold text-white"
        >
          LA
        </span>
        <span>
          <span className="block text-base font-semibold text-ink">
            Aviso de Los Aromos
          </span>
          <span className="block text-xs text-ink-2">
            {cast.handle ?? cast.name}
          </span>
        </span>
      </header>
      {items.length === 0 && <div className="px-4 py-6">{empty}</div>}
      <ul className="flex flex-col gap-3 px-3 py-4">
        {items.map((item) => (
          <li
            key={item.id}
            className="max-w-[94%] self-start rounded-2xl rounded-tl-sm border border-hairline bg-surface px-3 py-2.5"
          >
            <p className="text-sm font-semibold text-accent-text">
              {item.from}
            </p>
            <h3 className="text-base font-semibold text-ink">{item.subject}</h3>
            <div className="mt-2">{item.body}</div>
            <time
              dateTime={item.at}
              className="mt-1 block text-right text-xs text-ink-2"
            >
              {formatClock(item.at)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
