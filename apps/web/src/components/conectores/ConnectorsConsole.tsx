'use client';

import { Button, Card, Notice, StatusBadge } from '@team27/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { textLink } from '@/components/common/link-styles';
import { Empty, Loading, LoadError } from '@/components/common/LoadState';
import { RelativeTime } from '@/components/common/RelativeTime';
import { useResource } from '@/hooks/use-resource';
import { getProjects } from '@/lib/accounts-api';
import { describeError } from '@/lib/http';
import {
  authorizeGoogle,
  disconnectGoogle,
  type Feedback,
  getGoogle,
  type GoogleStatus,
  listeningText,
} from '@/lib/integrations-api';
import { projectPage } from '@/lib/project-paths';

const googleBadge = (google: GoogleStatus) =>
  !google.configured
    ? { tone: 'neutral' as const, label: 'Sin configurar' }
    : google.connection
      ? { tone: 'good' as const, label: 'Conectado' }
      : { tone: 'neutral' as const, label: 'Sin conectar' };

function GoogleAccountCard({
  google,
  busy,
  onConnect,
  onDisconnect,
}: {
  readonly google: GoogleStatus;
  readonly busy: boolean;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
}) {
  const badge = googleBadge(google);

  return (
    <Card
      title="Google Sheets"
      description={google.configured ? listeningText(google) : undefined}
      actions={<StatusBadge tone={badge.tone} label={badge.label} />}
    >
      {!google.configured ? (
        <Notice>
          Falta configurar Google en la API: define GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET e INTEGRATIONS_ENCRYPTION_KEY y reinicia la API.
        </Notice>
      ) : google.connection ? (
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
            Conecta tu cuenta de Google para vincular planillas a tus proyectos.
            Leemos cada planilla con la cuenta de quien la vinculó, y solo
            pedimos permiso para leer.
          </p>
          <Button disabled={busy} onClick={onConnect}>
            {busy ? 'Abriendo Google…' : 'Conectar con Google'}
          </Button>
        </div>
      )}
    </Card>
  );
}

function AutodeskCard() {
  return (
    <Card
      title="Autodesk Construction Cloud"
      description="Los presupuestos de Cost Management y las versiones del modelo."
      actions={<StatusBadge tone="neutral" label="Próximamente" />}
    >
      <p className="text-sm text-ink-2">
        Cada organización conecta su cuenta de Autodesk en{' '}
        <Link href="/cuenta" className={textLink}>
          Tu cuenta
        </Link>
        . Leer sus presupuestos y las versiones del modelo viene después.
      </p>
    </Card>
  );
}

function ProjectFilesLinks() {
  const projects = useResource(
    async (signal) => (await getProjects(signal)).projects,
    'projects',
  );

  return (
    <Card
      title="Archivos de tus proyectos"
      description="Las planillas se vinculan dentro de cada proyecto, en Archivos."
    >
      {projects.error && <LoadError message={projects.error} />}
      {!projects.data && !projects.error && <Loading />}
      {projects.data?.length === 0 && (
        <Empty>
          Todavía no tienes proyectos. Pídele a un administrador que invite tu
          correo a su organización.
        </Empty>
      )}
      {projects.data && projects.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {projects.data.map((project) => (
            <li key={project.id}>
              <Link
                href={projectPage(project.id, '/archivos') as Route}
                className={textLink}
              >
                {project.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ConnectorsConsole({
  initialFeedback,
}: {
  readonly initialFeedback: Feedback | null;
}) {
  const [version, setVersion] = useState(0);
  const google = useResource(getGoogle, `google:${version}`);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(initialFeedback);
  const [disconnecting, setDisconnecting] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await authorizeGoogle();
      window.location.assign(url);
    } catch (failure) {
      setFeedback({ tone: 'error', text: describeError(failure) });
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectGoogle();
      setFeedback({ tone: 'info', text: 'Desconectamos tu cuenta de Google.' });
      setVersion((value) => value + 1);
    } catch (failure) {
      setFeedback({ tone: 'error', text: describeError(failure) });
    } finally {
      setBusy(false);
      setDisconnecting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Conectores
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Conecta las cuentas donde ya vive la información de la obra. Después
          vinculas sus archivos en cada proyecto y escuchamos cuando algo cambia
          allá.
        </p>
      </header>

      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      {google.error && !google.data && <LoadError message={google.error} />}
      {!google.data && !google.error && <Loading />}
      {google.data && (
        <GoogleAccountCard
          google={google.data}
          busy={busy}
          onConnect={() => void connect()}
          onDisconnect={() => setDisconnecting(true)}
        />
      )}
      <AutodeskCard />
      <ProjectFilesLinks />

      {disconnecting && (
        <ConfirmDialog
          title="Desconectar Google"
          confirmLabel="Desconectar"
          busyLabel="Desconectando…"
          busy={busy}
          onConfirm={() => void disconnect()}
          onCancel={() => setDisconnecting(false)}
        >
          Las planillas que vinculaste siguen en sus proyectos, pero nadie las
          lee hasta que alguien las vuelva a vincular con su cuenta.
        </ConfirmDialog>
      )}
    </div>
  );
}
