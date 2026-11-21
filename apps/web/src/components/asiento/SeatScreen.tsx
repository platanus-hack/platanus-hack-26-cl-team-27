'use client';

import { Notice } from '@team27/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type ReactNode } from 'react';

import { ProposalDrawer } from '@/components/cambios/ProposalDrawer';
import { Avatar } from '@/components/common/Avatar';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Icon } from '@/components/common/Icon';
import { textLink } from '@/components/common/link-styles';
import {
  Empty,
  Loading,
  LoadError,
  WaitingForLake,
} from '@/components/common/LoadState';
import { Tabs } from '@/components/common/Tabs';
import { useSeatToken } from '@/hooks/use-held-seats';
import { useLive } from '@/hooks/use-live';
import { ApiError, describeError } from '@/lib/http';
import {
  getInbox,
  groupInbox,
  itemTime,
  publicInbox,
  type InboxDiscrepancy,
  type InboxItem,
  type InboxVote,
} from '@/lib/inbox-api';
import { getProposals, type ProposalView } from '@/lib/proposals-api';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';
import { CHANNEL_LABEL, getRoom, type CastMember } from '@/lib/room-api';
import { clearAllSeatTokens, clearSeatToken } from '@/lib/seat-storage';
import { getSpaces } from '@/lib/spaces-api';
import { dismissDiscrepancy } from '@/lib/votes-api';

import { AuthorActions } from './AuthorActions';
import { ChannelEntry, ChannelFrame, type ChannelEntryData } from './Channel';
import {
  AnsweredBody,
  DiscrepancyBody,
  FilteredBody,
  StaleBody,
  VoteBody,
} from './InboxBodies';
import { PresenceBadge } from './PresenceBadge';

interface SeatData {
  readonly cast: CastMember | null;
  readonly items: readonly InboxItem[];
  readonly authoring: readonly ProposalView[];
  readonly proposals: readonly ProposalView[];
  readonly revoked: boolean;
  readonly lakeEmpty: boolean;
}

type View = 'pending' | 'answered';

const proposalTitle = (vote: InboxVote, proposal: ProposalView | null) =>
  proposal?.elementName ?? vote.title;

export function SeatScreen({ castId }: { readonly castId: string }) {
  const router = useRouter();
  const { ready, token } = useSeatToken(castId);
  const [view, setView] = useState<View>('pending');
  const [openChange, setOpenChange] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<InboxDiscrepancy | null>(null);
  const [dismissBusy, setDismissBusy] = useState(false);
  const [dismissError, setDismissError] = useState<string | null>(null);

  const load = useCallback(
    async (signal: AbortSignal): Promise<SeatData> => {
      const room = await getRoom(signal);
      const lakeEmpty = room.lake.empty;
      const cast = room.cast.find((member) => member.id === castId) ?? null;
      const proposalsRequest = getProposals(undefined, signal);
      const readOnly = async (revoked: boolean): Promise<SeatData> => {
        const [proposals, spaces] = await Promise.all([
          proposalsRequest,
          getSpaces(signal),
        ]);
        return {
          cast,
          items: publicInbox(castId, proposals.proposals, spaces.spaces),
          authoring: [],
          proposals: proposals.proposals,
          revoked,
          lakeEmpty,
        };
      };
      if (!token) return readOnly(false);
      try {
        const [inbox, proposals] = await Promise.all([
          getInbox(castId, { seatToken: token }, signal),
          proposalsRequest,
        ]);
        return {
          cast,
          items: inbox.items,
          authoring: inbox.authoring,
          proposals: proposals.proposals,
          revoked: false,
          lakeEmpty,
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearSeatToken(castId);
          return readOnly(true);
        }
        throw error;
      }
    },
    [castId, token],
  );

  const { data, error, loading, status, events, reload } = useLive({
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

  const close = useCallback(() => setOpenChange(null), []);

  if (!ready || (loading && !data)) return <Loading />;
  if (!data)
    return (
      <div className="p-4">
        <LoadError message={error ?? 'No pudimos abrir tu asiento.'} />
      </div>
    );

  const { cast } = data;
  if (!cast)
    return (
      <div className="flex flex-col gap-3 p-4">
        <Notice tone="error">Ese asiento no existe.</Notice>
        <Link href="/" className={`${textLink} text-sm`}>
          Elegir un asiento
        </Link>
      </div>
    );

  const readOnly = !token;
  const channel = cast.channel ?? 'email';
  const proposalById = new Map(data.proposals.map((p) => [p.id, p]));
  const groups = groupInbox(data.items);
  const open = (changeId: string) => setOpenChange(changeId);

  const entryFor = (item: InboxItem): ChannelEntryData => {
    const base = { id: `${item.type}-${item.id}`, at: itemTime(item) || null };
    switch (item.type) {
      case 'vote': {
        const proposal = proposalById.get(item.proposalId) ?? null;
        const pending = groups.pending.includes(item);
        return {
          ...base,
          tag: pending ? 'Te piden revisar' : 'Respondido',
          tagTone: pending ? 'accent' : 'neutral',
          title: proposalTitle(item, proposal),
          unread: pending,
          body: pending ? (
            <VoteBody
              vote={item}
              proposal={proposal}
              seatToken={token}
              onDone={reload}
              onOpen={() => open(item.changeId)}
            />
          ) : (
            <AnsweredBody
              vote={item}
              proposal={proposal}
              onOpen={() => open(item.changeId)}
            />
          ),
        };
      }
      case 'discrepancy':
        return {
          ...base,
          tag: 'Discrepancia',
          tagTone: 'critical',
          title: `${item.subjectName} · ${item.label}`,
          unread: true,
          body: (
            <DiscrepancyBody
              item={item}
              seatToken={token}
              onDismiss={setDismissing}
            />
          ),
        };
      case 'stale':
        return {
          ...base,
          tag: 'Documento desfasado',
          tagTone: 'serious',
          title: `${item.documentTitle} · ${item.revisionLabel}`,
          unread: true,
          body: <StaleBody item={item} seatToken={token} onDone={reload} />,
        };
      case 'filtered':
        return {
          ...base,
          tag: 'Para tu información',
          tagTone: 'neutral',
          title: item.title,
          unread: false,
          body: <FilteredBody item={item} onOpen={() => open(item.changeId)} />,
        };
    }
  };

  const entries = (items: readonly InboxItem[]) =>
    items.map((item) => (
      <ChannelEntry
        key={`${item.type}-${item.id}`}
        channel={channel}
        entry={entryFor(item)}
      />
    ));

  const list = (
    items: readonly InboxItem[],
    empty: ReactNode,
    extra: readonly InboxItem[] = [],
  ) =>
    items.length === 0 && extra.length === 0 ? (
      <div className="bg-surface px-4 py-6">{empty}</div>
    ) : (
      <ChannelFrame channel={channel} cast={cast}>
        {items.length === 0 ? (
          <div className="px-4 py-4">{empty}</div>
        ) : (
          entries(items)
        )}
        {extra.length > 0 && (
          <h2 className="px-4 pt-4 pb-1 text-xs font-medium text-ink-2">
            Para tu información
          </h2>
        )}
        {entries(extra)}
      </ChannelFrame>
    );

  const confirmDismiss = async () => {
    if (!dismissing) return;
    setDismissBusy(true);
    setDismissError(null);
    try {
      await dismissDiscrepancy(dismissing.id, { seatToken: token });
      setDismissing(null);
      reload();
    } catch (failure) {
      setDismissError(describeError(failure));
    } finally {
      setDismissBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-hairline bg-surface px-4 py-3">
        <Avatar name={cast.name} tone="accent" size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-ink">
            {cast.name}
          </h1>
          <p className="truncate text-sm text-ink-2">
            {cast.role}
            {cast.channel && ` · ${CHANNEL_LABEL[cast.channel]}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <PresenceBadge
            status={readOnly ? 'connecting' : status}
            readOnly={readOnly}
          />
          <Link href="/sala" className={`${textLink} text-sm`}>
            Ver la sala
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-2 px-4 pt-3 empty:hidden">
        {status === 'offline' && (
          <Notice tone="error">Sin conexión. Seguimos intentando solos.</Notice>
        )}
        {data.revoked && (
          <Notice tone="error">
            Tu asiento se liberó.{' '}
            <Link className="underline" href="/">
              Tómalo de nuevo
            </Link>
            .
          </Notice>
        )}
        {cast.presenter && (
          <Notice>
            Este es el asiento de la presentadora. Sus avisos están en{' '}
            <Link className="underline" href="/presentador">
              la sala de Fernanda
            </Link>
            .
          </Notice>
        )}
        {readOnly && !data.revoked && !cast.presenter && (
          <Notice>
            Estás viendo este asiento en solo lectura.{' '}
            <Link className="underline" href="/">
              Toma un asiento
            </Link>{' '}
            para responder.
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>

      {data.lakeEmpty ? (
        <div className="p-4">
          <WaitingForLake>
            Cuando llegue la carga inicial, aquí aparecen tus avisos.
          </WaitingForLake>
        </div>
      ) : (
        <>
          <Tabs
            label="Tu bandeja"
            className="mt-2 bg-plane px-2"
            active={view}
            onChange={setView}
            tabs={[
              {
                id: 'pending',
                label: 'Pendientes',
                count: groups.pending.length,
              },
              {
                id: 'answered',
                label: 'Respondidos',
                count: groups.answered.length,
              },
            ]}
          />
          {view === 'pending'
            ? list(
                groups.pending,
                <Empty icon="check">
                  <span>
                    <span className="block font-semibold text-ink">
                      Estás al día
                    </span>
                    No tienes pendientes. Cuando un cambio te toque, llega aquí.
                  </span>
                </Empty>,
                groups.info,
              )
            : list(
                groups.answered,
                <Empty>Todavía no respondes ningún aviso.</Empty>,
              )}
        </>
      )}

      {data.authoring.length > 0 && (
        <section className="mt-6 px-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Tus propuestas
          </h2>
          <AuthorActions
            proposals={data.authoring}
            auth={{ seatToken: token }}
            onDone={reload}
          />
        </section>
      )}

      {openChange && (
        <ProposalDrawer
          changeId={openChange}
          forStakeholder={castId}
          refreshKey={events[0]?.seq ?? 0}
          onClose={close}
          onChanged={reload}
        />
      )}
      {dismissing && (
        <ConfirmDialog
          title="¿Descartar la discrepancia?"
          confirmLabel="Sí, descartar"
          busyLabel="Descartando…"
          busy={dismissBusy}
          error={dismissError}
          onConfirm={() => void confirmDismiss()}
          onCancel={() => {
            setDismissing(null);
            setDismissError(null);
          }}
        >
          {dismissing.sourceTitle} deja de contar como pendiente y lo vigente
          sigue igual.
        </ConfirmDialog>
      )}
      <p className="mt-6 flex items-center justify-center gap-1.5 px-4 text-center text-xs text-ink-3">
        <Icon name="lock" className="size-3.5" />
        Maqueta del canal: nada sale de la app.
      </p>
    </div>
  );
}
