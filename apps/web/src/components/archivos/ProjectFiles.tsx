'use client';

import { Button, Card, Notice, PageHeader, StatusBadge } from '@team27/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { buttonLink, textLink } from '@/components/common/link-styles';
import { Empty, Loading, LoadError } from '@/components/common/LoadState';
import { useLive } from '@/hooks/use-live';
import { useResource } from '@/hooks/use-resource';
import { getProject } from '@/lib/accounts-api';
import { describeError } from '@/lib/http';
import {
  authorizeGoogle,
  checkFeedback,
  checkSource,
  CONNECTORS_PATH,
  type ConnectorsOverview,
  type Feedback,
  getConnectors,
  linkFeedback,
  linkSheet,
  listeningText,
  type SourceView,
  unlinkSource,
} from '@/lib/integrations-api';
import { projectPage } from '@/lib/project-paths';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';

import { LinkSheetForm } from './LinkSheetForm';
import { SourceRow } from './SourceRow';

const REFRESH_MS = 15_000;

function GoogleSheetsCard({
  overview,
  busy,
  onConnect,
  onLink,
  onCheck,
  onUnlink,
}: {
  readonly overview: ConnectorsOverview;
  readonly busy: string | null;
  readonly onConnect: () => void;
  readonly onLink: (url: string) => Promise<boolean>;
  readonly onCheck: (source: SourceView) => void;
  readonly onUnlink: (source: SourceView) => void;
}) {
  const { google, sources } = overview;

  return (
    <Card
      title="Google Sheets"
      description={google.configured ? listeningText(google) : undefined}
    >
      {!google.configured ? (
        <Notice>
          Falta configurar Google en la API: define GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET e INTEGRATIONS_ENCRYPTION_KEY y reinicia la API.
        </Notice>
      ) : (
        <div className="flex flex-col gap-4">
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
            <Empty>Este proyecto todavía no tiene planillas vinculadas.</Empty>
          )}

          {google.connection ? (
            <>
              <LinkSheetForm busy={busy === 'link'} onSubmit={onLink} />
              <p className="text-sm text-ink-2">
                Vinculas con tu cuenta de Google,{' '}
                <span className="font-medium text-ink">
                  {google.connection.accountEmail}
                </span>
                . La cambias en{' '}
                <Link href={CONNECTORS_PATH} className={textLink}>
                  Conectores
                </Link>
                .
              </p>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-2">
                Para vincular planillas, conecta tu cuenta de Google. Leemos
                cada planilla con la cuenta de quien la vinculó, y solo pedimos
                permiso para leer.
              </p>
              <Button disabled={busy === 'connect'} onClick={onConnect}>
                {busy === 'connect'
                  ? 'Abriendo Google…'
                  : 'Conectar con Google'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function AutodeskFilesCard() {
  return (
    <Card
      title="Autodesk Construction Cloud"
      description="Los presupuestos de Cost Management y las versiones del modelo de este proyecto."
      actions={<StatusBadge tone="neutral" label="Próximamente" />}
    >
      <p className="text-sm text-ink-2">
        Cuando leamos ACC, sus archivos van a aparecer aquí junto a las
        planillas. La organización conecta su cuenta de Autodesk en{' '}
        <Link href="/cuenta" className={textLink}>
          Tu cuenta
        </Link>
        .
      </p>
    </Card>
  );
}

function ProjectSources({
  projectId,
  projectName,
  initialFeedback,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly initialFeedback: Feedback | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(initialFeedback);
  const [unlinking, setUnlinking] = useState<SourceView | null>(null);

  const load = useCallback(
    (signal: AbortSignal) => getConnectors(projectId, signal),
    [projectId],
  );

  const { data, error, loading, reload } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: projectId,
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
      setUnlinking(null);
      reload();
      return true;
    } catch (failure) {
      setFeedback({ tone: 'error', text: describeError(failure) });
      setUnlinking(null);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const connect = () =>
    void run('connect', async () => {
      const { url } = await authorizeGoogle(projectId);
      window.location.assign(url);
      return null;
    });

  const unlink = (source: SourceView) =>
    void run(source.id, async () => {
      await unlinkSource(projectId, source.id);
      return { tone: 'info', text: `Desvinculamos «${source.title}».` };
    });

  return (
    <>
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      {loading && !data && <Loading />}
      {error && !data && <LoadError message={error} />}

      {data && (
        <GoogleSheetsCard
          overview={data}
          busy={busy}
          onConnect={connect}
          onLink={(url) =>
            run('link', async () => {
              const { source } = await linkSheet(projectId, url);
              return linkFeedback(source, data.google.pollSeconds);
            })
          }
          onCheck={(source) =>
            void run(source.id, async () =>
              checkFeedback(await checkSource(projectId, source.id)),
            )
          }
          onUnlink={setUnlinking}
        />
      )}
      <AutodeskFilesCard />

      {unlinking && (
        <ConfirmDialog
          title={`Desvincular «${unlinking.title}»`}
          confirmLabel="Desvincular"
          busyLabel="Desvinculando…"
          busy={busy !== null}
          onConfirm={() => unlink(unlinking)}
          onCancel={() => setUnlinking(null)}
        >
          {projectName} deja de escuchar esa planilla.
        </ConfirmDialog>
      )}
    </>
  );
}

export function ProjectFiles({
  projectId,
  initialFeedback,
}: {
  readonly projectId: string;
  readonly initialFeedback: Feedback | null;
}) {
  const project = useResource(
    (signal) => getProject(projectId, signal),
    projectId,
  );

  if (project.error) {
    return (
      <>
        <PageHeader title="Archivos" />
        <LoadError message={project.error} />
      </>
    );
  }
  if (!project.data) return <Loading />;

  return (
    <>
      <PageHeader
        title="Archivos"
        description={`Las planillas y los archivos que escuchamos en ${project.data.name}.`}
        actions={
          <Link
            href={projectPage(projectId) as Route}
            className={buttonLink('secondary', 'sm')}
          >
            Volver al proyecto
          </Link>
        }
      />
      <div className="flex flex-col gap-4">
        <ProjectSources
          projectId={projectId}
          projectName={project.data.name}
          initialFeedback={initialFeedback}
        />
      </div>
    </>
  );
}
