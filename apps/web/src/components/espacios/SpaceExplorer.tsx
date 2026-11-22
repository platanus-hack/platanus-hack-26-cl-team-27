'use client';

import { cx } from '@team27/ui';
import { useCallback, useState } from 'react';

import { Icon } from '@/components/common/Icon';
import { EmptyPanel, Loading, LoadError } from '@/components/common/LoadState';
import { RelativeTime } from '@/components/common/RelativeTime';
import { SPACE_ICON } from '@/components/common/space-icon';
import { DocumentStateChip } from '@/components/common/status';
import { useProjectId } from '@/components/proyectos/ProjectContext';
import { useLive } from '@/hooks/use-live';
import { plural } from '@/lib/format';
import { projectPage } from '@/lib/project-paths';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';
import {
  findDocument,
  getSpaces,
  latestRevision,
  revisionCount,
  SPACE_KIND_LABEL,
  type SpaceView,
} from '@/lib/spaces-api';

import { DocumentDrawer } from './DocumentDrawer';

const syncUrl = (
  projectId: string,
  spaceId: string | null,
  documentId: string | null,
) => {
  const params = new URLSearchParams();
  if (spaceId) params.set('espacio', spaceId);
  if (documentId) params.set('documento', documentId);
  const query = params.toString();
  window.history.replaceState(
    null,
    '',
    projectPage(projectId, `/espacios${query ? `?${query}` : ''}`),
  );
};

function SpaceNav({
  spaces,
  activeId,
  onChange,
}: {
  readonly spaces: readonly SpaceView[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
}) {
  return (
    <nav aria-label="Espacios">
      <ul className="flex flex-wrap gap-1.5 md:flex-col md:gap-0.5">
        {spaces.map((space) => {
          const active = space.id === activeId;
          return (
            <li key={space.id}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onChange(space.id)}
                className={cx(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-accent',
                  active
                    ? 'bg-surface font-medium text-ink shadow-sm ring-1 ring-hairline'
                    : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )}
              >
                <Icon name={SPACE_ICON[space.kind]} className="size-4.5" />
                <span className="min-w-0 flex-1 truncate">{space.name}</span>
                <span className="hidden text-xs tabular-nums text-ink-3 md:inline">
                  {space.documents.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SpaceExplorer({
  initialSpace,
  initialDocument,
  initialRevision,
}: {
  readonly initialSpace: string | null;
  readonly initialDocument: string | null;
  readonly initialRevision: string | null;
}) {
  const projectId = useProjectId();
  const load = useCallback(
    (signal: AbortSignal) => getSpaces(projectId, signal),
    [projectId],
  );
  const { data, error, loading } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: projectId,
    projectId,
  });
  const [chosenSpace, setChosenSpace] = useState(initialSpace);
  const [openDocument, setOpenDocument] = useState<{
    documentId: string | null;
    revisionId: string | null;
  } | null>(
    initialDocument || initialRevision
      ? { documentId: initialDocument, revisionId: initialRevision }
      : null,
  );

  const spaces = data?.spaces ?? [];
  const document = openDocument ? findDocument(spaces, openDocument) : null;
  const active =
    spaces.find((space) => space.id === (document?.spaceId ?? chosenSpace)) ??
    spaces[0];

  const chooseSpace = (id: string) => {
    setChosenSpace(id);
    setOpenDocument(null);
    syncUrl(projectId, id, null);
  };
  const openDoc = (documentId: string) => {
    setOpenDocument({ documentId, revisionId: null });
    syncUrl(projectId, active?.id ?? null, documentId);
  };
  const close = useCallback(() => {
    setOpenDocument(null);
    syncUrl(projectId, active?.id ?? null, null);
  }, [projectId, active?.id]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Espacios
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Dónde vive hoy la información de la obra. Nadie migró nada: leemos
          cada documento donde está y mostramos el puntero al origen.
        </p>
      </header>

      {loading && !data && <Loading />}
      {error && !data && <LoadError message={error} />}
      {data && spaces.length === 0 && (
        <EmptyPanel title="Todavía no hay espacios">
          Cuando conectes las carpetas, los chats o el libro de obra del
          proyecto, sus documentos van a aparecer aquí.
        </EmptyPanel>
      )}
      {data && spaces.length > 0 && active && (
        <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
          <SpaceNav
            spaces={spaces}
            activeId={active.id}
            onChange={chooseSpace}
          />
          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {active.name}
                </h2>
                <p className="text-sm text-ink-2">
                  {SPACE_KIND_LABEL[active.kind]} · Dueño: {active.ownerName}
                </p>
              </div>
              <p className="text-sm text-ink-2">
                {plural(active.documents.length, 'documento', 'documentos')} ·{' '}
                {plural(revisionCount(active), 'revisión', 'revisiones')}
              </p>
            </div>
            {active.documents.length === 0 ? (
              <EmptyPanel title="Todavía no hay documentos">
                Este espacio todavía no tiene documentos.
              </EmptyPanel>
            ) : (
              <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-hairline text-left text-xs text-ink-2">
                      <th scope="col" className="px-4 py-2 font-medium">
                        Documento
                      </th>
                      <th
                        scope="col"
                        className="hidden px-3 py-2 font-medium sm:table-cell"
                      >
                        Responsable
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Estado
                      </th>
                      <th
                        scope="col"
                        className="hidden px-4 py-2 font-medium md:table-cell"
                      >
                        Última revisión
                      </th>
                    </tr>
                  </thead>
                  <tbody className="stagger">
                    {active.documents.map((item) => {
                      const revision = latestRevision(item);
                      return (
                        <tr
                          key={item.id}
                          className="relative border-b border-hairline transition-colors last:border-0 hover:bg-surface-2/60"
                        >
                          <td className="px-4 py-3 align-top">
                            <button
                              type="button"
                              onClick={() => openDoc(item.id)}
                              className="flex items-start gap-2 text-left text-sm leading-5 font-medium text-ink after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-accent"
                            >
                              <Icon name="file" className="mt-0.5 text-ink-3" />
                              {item.title}
                            </button>
                            <p className="text-xs text-ink-2 sm:hidden">
                              {item.ownerName}
                            </p>
                            {revision && (
                              <p className="text-xs text-ink-2 md:hidden">
                                {revision.label} ·{' '}
                                <RelativeTime at={revision.capturedAt} />
                              </p>
                            )}
                          </td>
                          <td className="hidden px-3 py-3 align-top text-sm text-ink sm:table-cell">
                            {item.ownerName}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <DocumentStateChip state={item.state} />
                          </td>
                          <td className="hidden px-4 py-3 align-top text-sm text-ink-2 md:table-cell">
                            {revision ? (
                              <>
                                <span className="text-ink">
                                  {revision.label}
                                </span>{' '}
                                · <RelativeTime at={revision.capturedAt} />
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {document && <DocumentDrawer document={document} onClose={close} />}
    </div>
  );
}
