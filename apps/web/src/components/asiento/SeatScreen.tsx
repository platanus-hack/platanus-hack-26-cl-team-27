'use client';

import { Notice } from '@team27/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, type ReactNode } from 'react';

import { Empty, Loading, LoadError } from '@/components/common/LoadState';
import { Icon } from '@/components/common/Icon';
import { initials } from '@/components/common/initials';
import { useSeatToken } from '@/hooks/use-held-seats';
import { useLive } from '@/hooks/use-live';
import { getTray, type TrayResponse } from '@/lib/drops-api';
import { ApiError } from '@/lib/http';
import {
  getInbox,
  isPending,
  itemTime,
  type InboxItem,
  type InboxResponse,
} from '@/lib/inbox-api';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';
import { getRoom, type CastMember } from '@/lib/room-api';
import { clearAllSeatTokens, clearSeatToken } from '@/lib/seat-storage';

import { AuthorActions } from './AuthorActions';
import { ChannelShell, type ChannelItem } from './ChannelShell';
import { DiscrepancyCard } from './DiscrepancyCard';
import { DropTray } from './DropTray';
import { FilteredCard } from './FilteredCard';
import { PresenceBadge } from './PresenceBadge';
import { StaleCard } from './StaleCard';
import { VoteCard } from './VoteCard';

interface SeatData {
  readonly cast: CastMember | null;
  readonly inbox: InboxResponse | null;
  readonly tray: TrayResponse | null;
  readonly revoked: boolean;
}

const SUBJECT: Record<InboxItem['type'], string> = {
  vote: '',
  discrepancy: 'Un valor no coincide con lo vigente',
  stale: 'Tu documento quedó desfasado',
  filtered: 'Este cambio no te toca',
};

export function SeatScreen({ castId }: { readonly castId: string }) {
  const router = useRouter();
  const { ready, token } = useSeatToken(castId);

  const load = useCallback(
    async (signal: AbortSignal): Promise<SeatData> => {
      const room = await getRoom(signal);
      const cast = room.cast.find((member) => member.id === castId) ?? null;
      if (!token) return { cast, inbox: null, tray: null, revoked: false };
      try {
        const [inbox, tray] = await Promise.all([
          getInbox(castId, { seatToken: token }, signal),
          getTray(castId, { seatToken: token }, signal),
        ]);
        return { cast, inbox, tray, revoked: false };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearSeatToken(castId);
          return { cast, inbox: null, tray: null, revoked: true };
        }
        throw error;
      }
    },
    [castId, token],
  );

  const { data, error, loading, status, reload } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: `${castId}:${token ?? ''}`,
    castId: token ? castId : null,
    seatToken: token,
    enabled: ready,
    onReset: () => {
      clearAllSeatTokens();
      router.replace('/');
    },
  });

  if (!ready || (loading && !data)) return <Loading />;
  if (!data)
    return (
      <div className="p-4">
        <LoadError message={error ?? 'No pudimos abrir tu asiento.'} />
      </div>
    );

  const { cast, inbox, tray } = data;
  if (!cast)
    return (
      <div className="flex flex-col gap-3 p-4">
        <Notice tone="error">Ese asiento no existe.</Notice>
        <Link
          href="/"
          className="text-sm font-medium text-accent-text hover:underline"
        >
          Elegir un asiento
        </Link>
      </div>
    );

  const readOnly = !token;
  const items = inbox?.items ?? [];
  const pending = items.filter(isPending);
  const rest = items.filter((item) => !isPending(item));
  const ordered = [...pending, ...rest].sort(
    (a, b) =>
      Number(isPending(b)) - Number(isPending(a)) ||
      itemTime(b).localeCompare(itemTime(a)),
  );

  const channelItems: ChannelItem[] = ordered.map((item): ChannelItem => {
    const body: ReactNode =
      item.type === 'vote' ? (
        <VoteCard item={item} seatToken={token} onDone={reload} />
      ) : item.type === 'discrepancy' ? (
        <DiscrepancyCard item={item} seatToken={token} onDone={reload} />
      ) : item.type === 'stale' ? (
        <StaleCard
          item={item}
          tray={tray?.items ?? []}
          seatToken={token}
          onDone={reload}
        />
      ) : (
        <FilteredCard item={item} castId={castId} />
      );
    return {
      id: `${item.type}-${item.id}`,
      from: item.type === 'vote' ? 'Aviso de cambio' : 'Los Aromos',
      at: itemTime(item),
      subject: item.type === 'vote' ? item.title : SUBJECT[item.type],
      unread: isPending(item),
      body,
    };
  });

  const upToDate = !readOnly && pending.length === 0;
  const channel = cast.channel ?? 'email';
  const auth = { seatToken: token };
  const authoring = inbox?.authoring ?? [];

  return (
    <div className="flex min-h-dvh flex-col gap-4 pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-hairline bg-surface px-4 py-3">
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-full bg-accent text-sm font-semibold text-on-accent"
        >
          {initials(cast.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-ink">
            {cast.name}
          </h1>
          <p className="truncate text-sm text-ink-2">{cast.role}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <PresenceBadge status={status} />
          <Link
            href="/sala"
            className="text-sm font-medium text-accent-text hover:underline"
          >
            Ver la sala
          </Link>
        </div>
      </header>

      {data.revoked && (
        <div className="px-4">
          <Notice tone="error">
            Tu asiento se liberó.{' '}
            <Link className="underline" href="/">
              Elige uno de nuevo
            </Link>
            .
          </Notice>
        </div>
      )}
      {readOnly && !data.revoked && (
        <div className="px-4">
          <Notice>
            Estás viendo este asiento en solo lectura.{' '}
            <Link className="underline" href="/">
              Toma un asiento
            </Link>{' '}
            para responder.
          </Notice>
        </div>
      )}
      {upToDate && channelItems.length > 0 && (
        <p className="flex items-center gap-2 px-4 text-base font-semibold text-ink">
          <Icon name="check" filled className="size-5 text-good" />
          Estás al día
        </p>
      )}
      {error && (
        <div className="px-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <ChannelShell
        channel={channel}
        cast={cast}
        items={channelItems}
        empty={
          upToDate ? (
            <p className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Icon name="check" filled className="size-6 text-good" />
              Estás al día
            </p>
          ) : (
            <Empty>Aquí aparecerán tus avisos.</Empty>
          )
        }
      />

      {authoring.length > 0 && (
        <section className="px-4">
          <h2 className="mb-2 text-base font-semibold text-ink">
            Tus propuestas
          </h2>
          <AuthorActions proposals={authoring} auth={auth} onDone={reload} />
        </section>
      )}

      {tray && tray.items.length > 0 && (
        <div className="px-4">
          <DropTray items={tray.items} auth={auth} onDone={reload} />
        </div>
      )}
    </div>
  );
}
