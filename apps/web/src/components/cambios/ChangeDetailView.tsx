'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useCallback } from 'react';

import { Icon } from '@/components/common/Icon';
import { PlanMark } from '@/components/common/IconBadge';
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
import { ChangeCoordinated } from './ChangeCoordinated';
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
    <article className="stagger mx-auto flex max-w-3xl flex-col gap-5">
      <nav className="text-sm">
        <Link
          href={projectPage(projectId) as Route}
          className={`${textLink} group`}
        >
          <Icon
            name="back"
            className="transition-transform group-hover:-translate-x-0.5"
          />
          Volver al proyecto
        </Link>
      </nav>
      <header className="flex items-center gap-4">
        <PlanMark className="size-16 sm:size-20" />
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wider text-ink-2 uppercase">
            Propuesta de cambio
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {changeTitle(data)}
          </h1>
        </div>
      </header>
      {data.proposal && <ChangeCoordinated proposal={data.proposal} />}
      <ChangeDetailBody
        change={data}
        forStakeholder={userId}
        response={
          <ChangeResponse change={data} userId={userId} onDone={reload} />
        }
      />
      <ChangeAnalysis
        projectId={projectId}
        changeId={changeId}
        change={data}
        userId={userId}
        onDone={reload}
      />
    </article>
  );
}
