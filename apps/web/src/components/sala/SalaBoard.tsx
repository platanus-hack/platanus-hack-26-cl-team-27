'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import { Loading, LoadError } from '@/components/common/LoadState';
import { LiveBadge } from '@/components/common/LiveBadge';
import { useLive } from '@/hooks/use-live';
import { getBaseline } from '@/lib/baseline-api';
import { getProposals, isActive } from '@/lib/proposals-api';
import { SALA_INTERVAL_MS } from '@/lib/pulse';
import { getRoom } from '@/lib/room-api';
import { getSpaces, staleDocuments } from '@/lib/spaces-api';

import { BaselineBoard, type ValueRef } from './BaselineBoard';
import { ConsensusRing } from './ConsensusRing';
import { EventTicker } from './EventTicker';
import { JoinQr } from './JoinQr';
import { ProposalStrip } from './ProposalStrip';
import { ProvenanceDrawer } from './ProvenanceDrawer';
import { SealBanner } from './SealBanner';
import { SpaceMap } from './SpaceMap';
import { StalePanel } from './StalePanel';
import { TotalsBar } from './TotalsBar';

const loadSala = async (signal: AbortSignal) => {
  const [room, baseline, spaces, proposals] = await Promise.all([
    getRoom(signal),
    getBaseline(undefined, signal),
    getSpaces(signal),
    getProposals('active', signal),
  ]);
  return { room, baseline, spaces, proposals };
};

export function SalaBoard() {
  const { data, error, loading, events, status } = useLive({
    load: loadSala,
    intervalMs: SALA_INTERVAL_MS,
  });
  const [selected, setSelected] = useState<ValueRef | null>(null);
  const close = useCallback(() => setSelected(null), []);

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink">
            {data?.room.project.name ?? 'La sala de la obra'}
          </h1>
          <p className="text-xl text-ink-2">
            {data
              ? `${data.room.project.location} · ${data.room.project.description}`
              : 'La verdad de la obra, consensuada'}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <LiveBadge status={status} large />
          <Link
            href="/"
            className="text-lg font-medium text-accent-text hover:underline"
          >
            Elegir asiento
          </Link>
        </div>
      </header>

      {loading && <Loading label="Abriendo la sala…" />}
      {error && !data && <LoadError message={error} />}

      {data && (
        <>
          {data.room.seal?.sealedAt && <SealBanner seal={data.room.seal} />}

          <section className="flex flex-wrap items-center justify-between gap-8 rounded-xl border border-hairline bg-surface p-6">
            <TotalsBar
              totals={data.baseline.totals}
              version={data.room.projectVersion}
            />
            <ConsensusRing
              upToDate={data.room.counters.upToDate}
              documents={data.room.counters.documents}
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-6">
              <ProposalStrip
                proposals={data.proposals.proposals.filter((p) =>
                  isActive(p.status),
                )}
              />
              <BaselineBoard
                entries={data.baseline.entries}
                onSelect={setSelected}
              />
            </div>
            <div className="flex flex-col gap-6">
              <StalePanel documents={staleDocuments(data.spaces.spaces)} />
              <SpaceMap spaces={data.room.spaces} />
              <EventTicker events={events} />
              <JoinQr />
            </div>
          </div>
        </>
      )}

      {selected && (
        <ProvenanceDrawer
          value={selected}
          refreshKey={data?.room.projectVersion ?? 0}
          onClose={close}
        />
      )}
    </div>
  );
}
