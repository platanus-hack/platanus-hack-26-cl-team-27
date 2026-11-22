'use client';

import { Button, Card, Notice, StatusBadge } from '@team27/ui';
import { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Loading, LoadError } from '@/components/common/LoadState';
import { RelativeTime } from '@/components/common/RelativeTime';
import { KeyGate } from '@/components/presentador/KeyGate';
import { useLive } from '@/hooks/use-live';
import { usePresenterKey } from '@/hooks/use-presenter-key';
import { ApiError, describeError } from '@/lib/http';
import {
  authorizeGoogle,
  checkFeedback,
  checkSource,
  type ConnectorsOverview,
  disconnectGoogle,
  type Feedback,
  getConnectors,
  linkFeedback,
  linkSheet,
  type SourceView,
  unlinkSource,
} from '@/lib/integrations-api';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';

import { LinkSheetForm } from './LinkSheetForm';
import { SourceRow } from './SourceRow';

const REJECTED = 'La clave no es correcta.';
const REFRESH_MS = 15_000;

type Confirm =
  | { readonly kind: 'disconnect' }
  | { readonly kind: 'unlink'; readonly source: SourceView };

function GoogleSheetsCard({
  overview,
  busy,
  onConnect,
  onDisconnect,
  onLink,
  onCheck,
  onUnlink,
}: {
  readonly overview: ConnectorsOverview;
  readonly busy: string | null;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
  readonly onLink: (url: string) => Promise<boolean>;
  readonly onCheck: (source: SourceView) => void;
  readonly onUnlink: (source: SourceView) => void;
}) {
  const { google, sources } = overview;
  const status = !google.configured
    ? { tone: 'neutral' as const, label: 'Sin configurar' }
    : google.connection
      ? { tone: 'good' as const, label: 'Conectado' }
      : { tone: 'neutral' as const, label: 'Sin conectar' };

  return (
    <Card
      title="Google Sheets"
      description={
        google.pollSeconds > 0
          ? `Escuchamos tus planillas: revisamos cada ${google.pollSeconds} s si cambiaron.`
          : 'La revisión automática está apagada: usa «Revisar ahora».'
      }
      actions={<StatusBadge tone={status.tone} label={status.label} />}
    >
      {!google.configured && (
        <Notice>
          Falta configurar Google en la API: define GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET e INTEGRATIONS_ENCRYPTION_KEY y reinicia la API.
        </Notice>
      )}

      {google.configured && !google.connection && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">
            Conecta la cuenta de Google que tiene acceso a tus planillas. Solo
            pedimos permiso para leer.
          </p>
          <Button disabled={busy === 'connect'} onClick={onConnect}>
            {busy === 'connect' ? 'Abriendo Google…' : 'Conectar con Google'}
          </Button>
        </div>
      )}

      {google.connection && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-ink-2">
              Conectado como{' '}
              <span className="font-medium text-ink">
                {google.connection.accountEmail}
              </span>{' '}
              · <RelativeTime at={google.connection.connectedAt} />
            </p>
            <Button variant="ghost" size="sm" onClick={onDisconnect}>
              Desconectar
            </Button>
          </div>

          {sources.length > 0 && (
            <ul className="flex flex-col gap-3">
              {sources.map((source) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  busy={busy === source.id}
                  onCheck={() => onCheck(source)}
                  onUnlink={() => onUnlink(source)}
                />
              ))}
            </ul>
          )}

          <LinkSheetForm busy={busy === 'link'} onSubmit={onLink} />
        </div>
      )}
    </Card>
  );
}

function AutodeskCard() {
  return (
    <Card
      title="Autodesk Construction Cloud"
      description="Los presupuestos de Cost Management y las versiones nuevas del modelo."
      actions={<StatusBadge tone="neutral" label="Próximamente" />}
    >
      <p className="text-sm text-ink-2">
        Mientras tanto, el modelo llega por el add-in de Revit.
      </p>
    </Card>
  );
}

export function ConnectorsConsole({
  initialFeedback,
}: {
  readonly initialFeedback: Feedback | null;
}) {
  const { ready, key, save, forget } = usePresenterKey();
  const [rejected, setRejected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(initialFeedback);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const load = useCallback(
    async (signal: AbortSignal): Promise<ConnectorsOverview | null> => {
      if (!key) return null;
      try {
        return await getConnectors({ presenterKey: key }, signal);
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

  const { data, error, loading, reload } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: key ?? '',
    enabled: ready && key !== null,
  });

  useEffect(() => {
    if (!key) return;
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [key, reload]);

  if (!ready) return <Loading />;
  if (!key)
    return (
      <KeyGate
        title="Conectores"
        message={rejected}
        onSubmit={(value) => {
          setRejected(null);
          save(value);
        }}
      />
    );

  const auth = { presenterKey: key };

  const run = async (
    id: string,
    action: () => Promise<Feedback | null>,
  ): Promise<boolean> => {
    setBusy(id);
    try {
      const result = await action();
      if (result) setFeedback(result);
      setConfirm(null);
      reload();
      return true;
    } catch (failure) {
      setFeedback({ tone: 'error', text: describeError(failure) });
      setConfirm(null);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const connect = () =>
    void run('connect', async () => {
      const { url } = await authorizeGoogle(auth);
      window.location.assign(url);
      return null;
    });

  const confirmAction = () => {
    if (!confirm) return;
    if (confirm.kind === 'disconnect') {
      void run('disconnect', async () => {
        await disconnectGoogle(auth);
        return { tone: 'info', text: 'Desconectamos tu cuenta de Google.' };
      });
      return;
    }
    const { source } = confirm;
    void run(source.id, async () => {
      await unlinkSource(source.id, auth);
      return { tone: 'info', text: `Desvinculamos «${source.title}».` };
    });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Conectores
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Conecta las herramientas donde ya vive la información de la obra y
          escuchamos cuando algo cambia allá.
        </p>
      </header>

      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      {loading && !data && <Loading />}
      {error && !data && <LoadError message={error} />}

      {data && (
        <>
          <GoogleSheetsCard
            overview={data}
            busy={busy}
            onConnect={connect}
            onDisconnect={() => setConfirm({ kind: 'disconnect' })}
            onLink={(url) =>
              run('link', async () => {
                const { source } = await linkSheet(url, auth);
                return linkFeedback(source, data.google.pollSeconds);
              })
            }
            onCheck={(source) =>
              void run(source.id, async () =>
                checkFeedback(await checkSource(source.id, auth)),
              )
            }
            onUnlink={(source) => setConfirm({ kind: 'unlink', source })}
          />
          <AutodeskCard />
        </>
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === 'disconnect'
              ? 'Desconectar Google'
              : `Desvincular «${confirm.source.title}»`
          }
          confirmLabel={
            confirm.kind === 'disconnect' ? 'Desconectar' : 'Desvincular'
          }
          busyLabel={
            confirm.kind === 'disconnect' ? 'Desconectando…' : 'Desvinculando…'
          }
          busy={busy !== null}
          onConfirm={confirmAction}
          onCancel={() => setConfirm(null)}
        >
          {confirm.kind === 'disconnect'
            ? 'Dejamos de escuchar tus planillas y las desvinculamos.'
            : 'Dejamos de escuchar esa planilla.'}
        </ConfirmDialog>
      )}
    </div>
  );
}
