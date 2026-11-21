'use client';

import { BrandMark, BrandWordmark } from '@team27/ui';
import Link from 'next/link';
import { useCallback, useState, type ReactNode } from 'react';

import { ProposalDrawer } from '@/components/cambios/ProposalDrawer';
import { textLink } from '@/components/common/link-styles';
import { LiveBadge } from '@/components/common/LiveBadge';
import {
  Loading,
  LoadError,
  WaitingForLake,
} from '@/components/common/LoadState';
import { SectionHeader } from '@/components/common/SectionHeader';
import { DocumentDrawer } from '@/components/espacios/DocumentDrawer';
import { useLive } from '@/hooks/use-live';
import { getBaseline } from '@/lib/baseline-api';
import { byLastActivity, getProposals, isActive } from '@/lib/proposals-api';
import { SALA_INTERVAL_MS } from '@/lib/pulse';
import { getRoom } from '@/lib/room-api';
import { findDocument, getSpaces, pendingDocuments } from '@/lib/spaces-api';

import { ActivityFeed } from './ActivityFeed';
import { JoinQr } from './JoinQr';
import { PendingDocuments } from './PendingDocuments';
import { ProposalList } from './ProposalList';
import { ProvenanceDrawer, type ValueRef } from './ProvenanceDrawer';
import { SealBanner } from './SealBanner';
import { SpaceList } from './SpaceList';
import { SummaryStrip } from './SummaryStrip';
import { ValueTable } from './ValueTable';

const loadSala = async (signal: AbortSignal) => {
  const [room, baseline, spaces, proposals] = await Promise.all([
    getRoom(signal),
    getBaseline(undefined, signal),
    getSpaces(signal),
    getProposals('active', signal),
  ]);
  return { room, baseline, spaces, proposals };
};

type Panel =
  | { readonly kind: 'value'; readonly value: ValueRef }
  | { readonly kind: 'proposal'; readonly changeId: string }
  | { readonly kind: 'document'; readonly documentId: string };

function Aside({
  title,
  count,
  children,
}: {
  readonly title: string;
  readonly count?: number;
  readonly children: ReactNode;
}) {
  return (
    <section className="px-5 py-4">
      <SectionHeader title={title} count={count} as="h3" className="mb-3" />
      {children}
    </section>
  );
}

export function SalaBoard() {
  const { data, error, loading, events, status } = useLive({
    load: loadSala,
    intervalMs: SALA_INTERVAL_MS,
  });
  const [panel, setPanel] = useState<Panel | null>(null);
  const close = useCallback(() => setPanel(null), []);
  const refreshKey = events[0]?.seq ?? 0;

  const proposals = data
    ? byLastActivity(data.proposals.proposals.filter((p) => isActive(p.status)))
    : [];
  const pending = data ? pendingDocuments(data.spaces.spaces) : [];
  const openDocument =
    panel?.kind === 'document' && data
      ? findDocument(data.spaces.spaces, { documentId: panel.documentId })
      : null;

  return (
    <div className="sala-root mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-hairline pb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-2 text-ink">
            <BrandMark className="size-8 text-accent-text" />
            <BrandWordmark className="h-6 w-auto" />
          </span>
          <div className="min-w-0 border-hairline sm:border-l sm:pl-5">
            <h1 className="text-lg font-semibold text-ink">
              {data?.room.project.name ?? 'La sala de la obra'}
            </h1>
            <p className="text-sm text-ink-2">
              {data
                ? `${data.room.project.location} · ${data.room.project.description}`
                : 'La verdad de la obra, consensuada'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <LiveBadge status={status} />
          <Link href="/" className={`${textLink} text-sm`}>
            Elegir asiento →
          </Link>
        </div>
      </header>

      {loading && !data && <Loading label="Abriendo la sala…" />}
      {error && !data && <LoadError message={error} />}
      {data?.room.lake.empty && <WaitingForLake />}

      {data && !data.room.lake.empty && (
        <>
          {data.room.seal?.sealedAt && <SealBanner seal={data.room.seal} />}

          <SummaryStrip
            totals={data.baseline.totals}
            version={data.room.projectVersion}
            counters={data.room.counters}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              <section className="flex flex-col gap-3">
                <SectionHeader
                  title="Propuestas abiertas"
                  count={proposals.length}
                />
                <ProposalList
                  proposals={proposals}
                  onOpen={(proposal) =>
                    setPanel({ kind: 'proposal', changeId: proposal.changeId })
                  }
                />
              </section>
              <section className="flex flex-col gap-3">
                <SectionHeader
                  title="Lo vigente"
                  action={
                    <span className="text-sm text-ink-2">
                      Toca un valor para ver de dónde salió
                    </span>
                  }
                />
                <ValueTable
                  entries={data.baseline.entries}
                  onSelect={(value) => setPanel({ kind: 'value', value })}
                />
              </section>
            </div>

            <aside className="flex min-w-0 flex-col divide-y divide-hairline self-start rounded-xl border border-hairline bg-surface">
              <Aside title="Pendientes de actualizar" count={pending.length}>
                <PendingDocuments
                  documents={pending}
                  onOpen={(document) =>
                    setPanel({ kind: 'document', documentId: document.id })
                  }
                />
              </Aside>
              <Aside title="Espacios conectados">
                <SpaceList spaces={data.room.spaces} />
              </Aside>
              <Aside title="Actividad reciente">
                <ActivityFeed events={events} />
              </Aside>
              <div className="px-5 py-4">
                <JoinQr />
              </div>
            </aside>
          </div>
        </>
      )}

      {panel?.kind === 'value' && (
        <ProvenanceDrawer
          value={panel.value}
          refreshKey={refreshKey}
          onClose={close}
        />
      )}
      {panel?.kind === 'proposal' && (
        <ProposalDrawer
          changeId={panel.changeId}
          refreshKey={refreshKey}
          onClose={close}
          respond={false}
        />
      )}
      {openDocument && (
        <DocumentDrawer document={openDocument} onClose={close} />
      )}
    </div>
  );
}
