'use client';

import { Card, Notice, PageHeader } from '@team27/ui';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import { AuthorActions } from '@/components/asiento/AuthorActions';
import {
  Loading,
  LoadError,
  WaitingForLake,
} from '@/components/common/LoadState';
import { LiveBadge } from '@/components/common/LiveBadge';
import { usePresenterKey } from '@/hooks/use-presenter-key';
import { useLive } from '@/hooks/use-live';
import { ApiError } from '@/lib/http';
import { getProposals, isActive } from '@/lib/proposals-api';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';
import { getRoom } from '@/lib/room-api';

import { KeyGate } from './KeyGate';
import { ResetButton } from './ResetButton';
import { SeatOccupancy } from './SeatOccupancy';

const REJECTED = 'La clave no es correcta.';

export function PresenterConsole() {
  const presenter = usePresenterKey();
  const [rejected, setRejected] = useState<string | null>(null);
  const { ready, key, save, forget } = presenter;

  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        const room = await getRoom(signal);
        const proposals = await getProposals('active', signal);
        return { room, proposals };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          forget();
          setRejected(REJECTED);
        }
        throw error;
      }
    },
    [key, forget],
  );

  const { data, error, loading, status, reload } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: key ?? '',
    enabled: ready && key !== null,
  });

  if (!ready) return <Loading />;
  if (!key)
    return (
      <KeyGate
        message={rejected}
        onSubmit={(value) => {
          setRejected(null);
          save(value);
        }}
      />
    );

  const auth = { presenterKey: key };

  return (
    <>
      <PageHeader
        title="Presentador"
        description="Asientos, propuestas y reinicio de la sala."
        actions={
          <div className="flex items-center gap-4">
            <LiveBadge status={status} />
            <Link
              href="/sala"
              className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong"
            >
              Abrir la sala
            </Link>
          </div>
        }
      />
      {loading && !data && <Loading />}
      {error && !data && <LoadError message={error} />}
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            {data.room.lake.empty ? (
              <WaitingForLake />
            ) : (
              <Notice>
                Los documentos llegan por el ETL: <code>pnpm etl</code>.
              </Notice>
            )}
            <ResetButton auth={auth} onDone={reload} />
          </div>
          <div className="flex flex-col gap-4">
            <Card title="Propuestas abiertas">
              <AuthorActions
                proposals={data.proposals.proposals.filter((p) =>
                  isActive(p.status),
                )}
                auth={auth}
                onDone={reload}
              />
            </Card>
            <SeatOccupancy cast={data.room.cast} auth={auth} onDone={reload} />
          </div>
        </div>
      )}
    </>
  );
}
