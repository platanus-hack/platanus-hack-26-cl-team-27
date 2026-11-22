'use client';

import { Button, Card, Field, Notice, Select, StatusBadge } from '@team27/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { textLink } from '@/components/common/link-styles';
import { Empty, Loading, LoadError } from '@/components/common/LoadState';
import { RelativeTime } from '@/components/common/RelativeTime';
import { useLive } from '@/hooks/use-live';
import { useResource } from '@/hooks/use-resource';
import { type AccountProject, getProjects } from '@/lib/accounts-api';
import { describeError } from '@/lib/http';
import {
  authorizeGoogle,
  checkFeedback,
  checkSource,
  type ConnectorsOverview,
  connectorsHref,
  disconnectGoogle,
  type Feedback,
  getConnectors,
  linkFeedback,
  linkSheet,
  pickProject,
  type SourceView,
  unlinkSource,
} from '@/lib/integrations-api';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';

import { LinkSheetForm } from './LinkSheetForm';
import { SourceRow } from './SourceRow';

const REFRESH_MS = 15_000;

type Confirm =
  | { readonly kind: 'disconnect' }
  | { readonly kind: 'unlink'; readonly source: SourceView };

function ProjectPicker({
  projects,
  selected,
  onSelect,
}: {
  readonly projects: readonly AccountProject[];
  readonly selected: AccountProject;
  readonly onSelect: (project: AccountProject) => void;
}) {
  if (projects.length === 1) {
    return (
      <p className="text-sm text-ink-2">
        Proyecto: <span className="font-medium text-ink">{selected.name}</span>
      </p>
    );
  }
  return (
    <Field
      label="Proyecto"
      hint="Cada proyecto ve solo las planillas vinculadas a él."
    >
      <Select
        value={selected.id}
        onChange={(event) => {
          const project = projects.find(
            (item) => item.id === event.target.value,
          );
          if (project) onSelect(project);
        }}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function GoogleSheetsCard({
  project,
  overview,
  busy,
  onConnect,
  onDisconnect,
  onLink,
  onCheck,
  onUnlink,
}: {
  readonly project: AccountProject;
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
        google.push.enabled
          ? `Escuchamos las planillas de ${project.name}: Google nos avisa al instante cuando alguien las edita.`
          : google.pollSeconds > 0
            ? `Escuchamos las planillas de ${project.name}: revisamos cada ${google.pollSeconds} s si cambiaron.`
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

      {google.configured && (
        <div className="flex flex-col gap-4">
          {google.connection ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-ink-2">
                Tu cuenta de Google:{' '}
                <span className="font-medium text-ink">
                  {google.connection.accountEmail}
                </span>{' '}
                · <RelativeTime at={google.connection.connectedAt} />
              </p>
              <Button variant="ghost" size="sm" onClick={onDisconnect}>
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-2">
                Conecta tu cuenta de Google para vincular planillas. Leemos cada
                planilla con la cuenta de quien la vinculó, y solo pedimos
                permiso para leer.
              </p>
              <Button disabled={busy === 'connect'} onClick={onConnect}>
                {busy === 'connect'
                  ? 'Abriendo Google…'
                  : 'Conectar con Google'}
              </Button>
            </div>
          )}

          {sources.length > 0 ? (
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
          ) : (
            <Empty>{project.name} todavía no tiene planillas vinculadas.</Empty>
          )}

          {google.connection && (
            <LinkSheetForm busy={busy === 'link'} onSubmit={onLink} />
          )}
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
        Cada organización conecta su cuenta de Autodesk en{' '}
        <Link href="/cuenta" className={textLink}>
          Tu cuenta
        </Link>
        . Leer sus presupuestos y versiones viene después; mientras tanto, el
        modelo llega por el add-in de Revit.
      </p>
    </Card>
  );
}

function ProjectConnectors({
  project,
  initialFeedback,
}: {
  readonly project: AccountProject;
  readonly initialFeedback: Feedback | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(initialFeedback);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const load = useCallback(
    (signal: AbortSignal) => getConnectors(project.id, signal),
    [project.id],
  );

  const { data, error, loading, reload } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: project.id,
  });

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

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
      const { url } = await authorizeGoogle(project.id);
      window.location.assign(url);
      return null;
    });

  const confirmAction = () => {
    if (!confirm) return;
    if (confirm.kind === 'disconnect') {
      void run('disconnect', async () => {
        await disconnectGoogle();
        return { tone: 'info', text: 'Desconectamos tu cuenta de Google.' };
      });
      return;
    }
    const { source } = confirm;
    void run(source.id, async () => {
      await unlinkSource(project.id, source.id);
      return { tone: 'info', text: `Desvinculamos «${source.title}».` };
    });
  };

  return (
    <>
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      {loading && !data && <Loading />}
      {error && !data && <LoadError message={error} />}

      {data && (
        <>
          <GoogleSheetsCard
            project={project}
            overview={data}
            busy={busy}
            onConnect={connect}
            onDisconnect={() => setConfirm({ kind: 'disconnect' })}
            onLink={(url) =>
              run('link', async () => {
                const { source } = await linkSheet(project.id, url);
                return linkFeedback(source, data.google.pollSeconds);
              })
            }
            onCheck={(source) =>
              void run(source.id, async () =>
                checkFeedback(await checkSource(project.id, source.id)),
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
            ? 'Las planillas que vinculaste siguen en sus proyectos, pero nadie las lee hasta que alguien las vuelva a vincular con su cuenta.'
            : `${project.name} deja de escuchar esa planilla.`}
        </ConfirmDialog>
      )}
    </>
  );
}

export function ConnectorsConsole({
  initialProject,
  initialFeedback,
}: {
  readonly initialProject: string | null;
  readonly initialFeedback: Feedback | null;
}) {
  const [requested, setRequested] = useState<string | null>(initialProject);
  const projects = useResource(
    async (signal) => (await getProjects(signal)).projects,
    'projects',
  );

  const selected = projects.data ? pickProject(projects.data, requested) : null;

  const select = (project: AccountProject) => {
    setRequested(project.id);
    window.history.replaceState(null, '', connectorsHref(project.id));
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

      {projects.error && <LoadError message={projects.error} />}
      {!projects.data && !projects.error && <Loading />}
      {projects.data && selected === null && (
        <Empty>
          Todavía no tienes proyectos. Pídele a un administrador que invite tu
          correo a su organización.
        </Empty>
      )}

      {projects.data && selected && (
        <>
          <ProjectPicker
            projects={projects.data}
            selected={selected}
            onSelect={select}
          />
          <ProjectConnectors
            key={selected.id}
            project={selected}
            initialFeedback={
              selected.id === (initialProject ?? selected.id)
                ? initialFeedback
                : null
            }
          />
        </>
      )}
    </div>
  );
}
