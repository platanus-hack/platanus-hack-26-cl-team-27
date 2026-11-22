'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useCallback } from 'react';

import { Loading, LoadError } from '@/components/common/LoadState';
import { textLink } from '@/components/common/link-styles';
import { useProjectId } from '@/components/proyectos/ProjectContext';
import { useLive } from '@/hooks/use-live';
import { projectPage } from '@/lib/project-paths';
import { getProvenance } from '@/lib/provenance-api';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';

import { ProvenanceChain, ProvenanceSummary } from './ProvenanceChain';
import { useChangeIds } from './use-change-ids';

export function ValuePage({
  subjectId,
  attribute,
}: {
  readonly subjectId: string;
  readonly attribute: string;
}) {
  const projectId = useProjectId();
  const load = useCallback(
    (signal: AbortSignal) =>
      getProvenance(projectId, subjectId, attribute, signal),
    [projectId, subjectId, attribute],
  );
  const { data, error, loading, events } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: `${projectId}/${subjectId}/${attribute}`,
    projectId,
  });
  const changeIdOf = useChangeIds(events[0]?.seq ?? 0);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <nav className="text-sm">
        <Link href={projectPage(projectId) as Route} className={textLink}>
          ← Volver al proyecto
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-2">Procedencia</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          ¿De dónde salió este valor?
        </h1>
      </header>
      {loading && !data && <Loading />}
      {error && !data && <LoadError message={error} />}
      {data && (
        <>
          <div className="rounded-xl border border-hairline bg-surface p-5">
            <ProvenanceSummary provenance={data} />
          </div>
          <ProvenanceChain provenance={data} changeIdOf={changeIdOf} />
        </>
      )}
    </article>
  );
}
