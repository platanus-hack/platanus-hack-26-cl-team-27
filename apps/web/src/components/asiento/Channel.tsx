import { cx } from '@team27/ui';
import type { ReactNode } from 'react';

import { RelativeTime } from '@/components/common/RelativeTime';
import type { CastMember, Channel } from '@/lib/room-api';

export interface ChannelEntryData {
  readonly id: string;
  readonly tag: string;
  readonly tagTone: 'accent' | 'critical' | 'serious' | 'neutral';
  readonly at: string | null;
  readonly title: string;
  readonly unread: boolean;
  readonly body: ReactNode;
}

const TAG_TONE = {
  accent: 'bg-accent-soft/40 text-ink',
  critical: 'bg-critical/12 text-critical-text',
  serious: 'bg-serious/20 text-ink',
  neutral: 'bg-surface-2 text-ink-2',
} as const;

function Tag({ entry }: { readonly entry: ChannelEntryData }) {
  return (
    <span
      className={cx(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        TAG_TONE[entry.tagTone],
      )}
    >
      {entry.tag}
    </span>
  );
}

function EntryHead({ entry }: { readonly entry: ChannelEntryData }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        {entry.unread && (
          <span
            aria-label="Sin leer"
            className="size-2 rounded-full bg-accent"
          />
        )}
        <Tag entry={entry} />
      </span>
      <RelativeTime at={entry.at} className="text-xs text-ink-2" />
    </div>
  );
}

export function ChannelFrame({
  channel,
  cast,
  children,
}: {
  readonly channel: Channel;
  readonly cast: CastMember;
  readonly children: ReactNode;
}) {
  if (channel === 'whatsapp')
    return (
      <section aria-label="Chat de la obra" className="flex flex-col bg-good/8">
        <header className="flex items-center gap-3 border-b border-hairline bg-surface px-4 py-2.5">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-full bg-good text-xs font-semibold text-white"
          >
            LA
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              Aviso de Los Aromos
            </span>
            <span className="block truncate text-xs text-ink-2">
              {cast.handle ?? cast.name}
            </span>
          </span>
        </header>
        <div className="flex flex-col gap-3 px-3 py-4">{children}</div>
      </section>
    );
  if (channel === 'slack')
    return (
      <section
        aria-label="Canal del equipo"
        className="flex flex-col bg-surface"
      >
        <header className="border-b border-hairline px-4 py-2.5">
          <span className="block text-sm font-semibold text-ink">
            {cast.handle ?? '#los-aromos'}
          </span>
          <span className="block text-xs text-ink-2">
            Mensajes de Vigente en el canal del equipo
          </span>
        </header>
        <div className="flex flex-col divide-y divide-hairline">{children}</div>
      </section>
    );
  return (
    <section
      aria-label="Bandeja de entrada"
      className="flex flex-col bg-surface"
    >
      <header className="border-b border-hairline px-4 py-2.5">
        <span className="block text-sm font-semibold text-ink">
          Bandeja de entrada
        </span>
        <span className="block truncate text-xs text-ink-2">
          {cast.handle ?? cast.name}
        </span>
      </header>
      <div className="flex flex-col divide-y divide-hairline">{children}</div>
    </section>
  );
}

export function ChannelEntry({
  channel,
  entry,
}: {
  readonly channel: Channel;
  readonly entry: ChannelEntryData;
}) {
  if (channel === 'whatsapp')
    return (
      <article className="w-[94%] self-start rounded-2xl rounded-tl-sm border border-hairline bg-surface px-3.5 py-3 shadow-sm">
        <EntryHead entry={entry} />
        <h3 className="mt-2 text-base font-semibold text-ink">{entry.title}</h3>
        <div className="mt-2">{entry.body}</div>
      </article>
    );
  if (channel === 'slack')
    return (
      <article className="flex gap-3 px-4 py-4">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-xs font-semibold text-on-accent"
        >
          V
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-semibold text-ink">Vigente</p>
          <EntryHead entry={entry} />
          <h3 className="mt-2 text-base font-semibold text-ink">
            {entry.title}
          </h3>
          <div className="mt-2">{entry.body}</div>
        </div>
      </article>
    );
  return (
    <article className="px-4 py-4">
      <p
        className={cx(
          'mb-1 text-sm',
          entry.unread ? 'font-semibold text-ink' : 'text-ink-2',
        )}
      >
        Vigente · Los Aromos
      </p>
      <EntryHead entry={entry} />
      <h3 className="mt-2 text-base font-semibold text-ink">{entry.title}</h3>
      <div className="mt-2">{entry.body}</div>
    </article>
  );
}
