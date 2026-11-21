'use client';

import { Button, Notice } from '@team27/ui';
import { useState } from 'react';

import { Icon } from '@/components/common/Icon';
import { Loading, LoadError } from '@/components/common/LoadState';
import { KeyGate } from '@/components/presentador/KeyGate';
import { usePresenterKey } from '@/hooks/use-presenter-key';
import { useFlow } from '@/hooks/use-flow';
import { presenceOf } from '@/lib/case-view';
import { formatClock } from '@/lib/format';
import { AFFECTED_ID, AUTHOR_ID, resetFlow } from '@/lib/flow-api';
import { ApiError, describeError } from '@/lib/http';

import { CamilaView } from './CamilaView';
import { CaseHistory } from './HistoryPanel';
import { PaulaView } from './PaulaView';

const REJECTED = 'La clave no es correcta.';

function Connected({
  presenterKey,
  onForget,
}: {
  readonly presenterKey: string;
  readonly onForget: () => void;
}) {
  const { data, error, loading, events, reload } = useFlow({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const reset = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await resetFlow({ presenterKey });
      reload();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onForget();
      setActionError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Loading label="Abriendo el caso…" />;
  if (!data)
    return (
      <div className="p-4">
        <LoadError message={error ?? 'No pudimos abrir el caso.'} />
      </div>
    );

  const flowEvents = events.filter((event) => event.kind.startsWith('flow.'));
  const lastReset = flowEvents
    .map((event) => event.kind)
    .lastIndexOf('flow.reset');
  const thread = flowEvents.slice(lastReset + 1);
  const camilaPresence = presenceOf(data.presence, AFFECTED_ID);
  const camilaState = !camilaPresence?.online
    ? 'Sin conexión'
    : camilaPresence.viewing === 'propuesta'
      ? 'Revisando la propuesta'
      : 'En línea';
  const asPaula = { presenterKey, actAs: AUTHOR_ID };
  const asCamila = { presenterKey, actAs: AFFECTED_ID };

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{data.case.title}</h1>
          <p className="text-sm text-ink-2">
            {data.case.level}, {data.case.axis}
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void reset()}
        >
          <Icon name="refresh" className="size-4" />
          {busy ? 'Reiniciando…' : 'Reiniciar caso'}
        </Button>
      </header>
      {actionError && <Notice tone="error">{actionError}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_320px]">
        <section aria-label="Pantalla de Paula Rojas" className="min-w-0">
          <h2 className="mb-2 text-base font-semibold text-ink">
            Paula Rojas · Ingeniera calculista
          </h2>
          <PaulaView flow={data} auth={asPaula} onChanged={reload} />
        </section>
        <section aria-label="Pantalla de Camila Vera" className="min-w-0">
          <h2 className="mb-2 text-base font-semibold text-ink">
            Camila Vera · Instalaciones eléctricas · {camilaState}
          </h2>
          <CamilaView
            flow={data}
            auth={asCamila}
            reportPresence={false}
            onChanged={reload}
          />
        </section>
        <aside aria-label="Hilo de eventos" className="min-w-0">
          <h2 className="mb-2 text-base font-semibold text-ink">Hilo</h2>
          {thread.length === 0 ? (
            <p className="text-sm text-ink-2">Todavía no pasa nada.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {thread.map((event) => (
                <li
                  key={event.seq}
                  className="rounded-lg border border-hairline bg-surface px-3 py-2"
                >
                  <p className="text-xs text-ink-3">{formatClock(event.at)}</p>
                  <p className="text-sm text-ink">{event.message}</p>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
      <CaseHistory flow={data} wide />
    </div>
  );
}

export function CasePresenter() {
  const { ready, key, save, forget } = usePresenterKey();
  const [rejected, setRejected] = useState<string | null>(null);

  if (!ready) return <Loading />;
  if (!key)
    return (
      <div className="px-4">
        <KeyGate onSubmit={save} message={rejected} title="Caso Los Aromos" />
      </div>
    );
  return (
    <Connected
      presenterKey={key}
      onForget={() => {
        forget();
        setRejected(REJECTED);
      }}
    />
  );
}
