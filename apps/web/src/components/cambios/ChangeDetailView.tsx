'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useCallback } from 'react';

import { Loading, LoadError } from '@/components/common/LoadState';
import { textLink } from '@/components/common/link-styles';
import { useProjectId } from '@/components/proyectos/ProjectContext';
import { useLive } from '@/hooks/use-live';
import { useResource } from '@/hooks/use-resource';
import { getMe } from '@/lib/accounts-api';
import { getChange } from '@/lib/changes-api';
import { projectPage } from '@/lib/project-paths';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';

import { ChangeAnalysis } from './ChangeAnalysis';
import { ChangeDetailBody, changeTitle } from './ChangeDetailBody';
import { ChangeResponse } from './ChangeResponse';

export function ChangeDetailView({ changeId }: { readonly changeId: string }) {
  const projectId = useProjectId();
  const me = useResource(getMe, 'me');
  const load = useCallback(
    (signal: AbortSignal) => getChange(projectId, changeId, signal),
    [projectId, changeId],
  );
  const { data, error, loading, reload } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: `${projectId}/${changeId}`,
    projectId,
  });

  if (loading && !data) return <Loading />;
  if (!data)
    return <LoadError message={error ?? 'No encontramos este cambio.'} />;

  const userId = me.data?.user.id ?? null;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <nav className="text-sm">
        <Link href={projectPage(projectId) as Route} className={textLink}>
          ← Volver al proyecto
        </Link>
      </nav>
      <header>
        <p className="text-sm text-ink-2">Propuesta de cambio</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {changeTitle(data)}
        </h1>
      </header>
      <ChangeDetailBody
        change={data}
        forStakeholder={userId}
        response={
          <ChangeResponse change={data} userId={userId} onDone={reload} />
        }
      />
      <ChangeAnalysis projectId={projectId} changeId={changeId} change={data} />
    </article>
  );
}
