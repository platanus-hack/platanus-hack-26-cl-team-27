'use client';

import Link from 'next/link';
import { useCallback } from 'react';

import { Loading, LoadError } from '@/components/common/LoadState';
import { textLink } from '@/components/common/link-styles';
import { useLive } from '@/hooks/use-live';
import { getChange } from '@/lib/changes-api';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';

import { ChangeDetailBody, changeTitle } from './ChangeDetailBody';
import { ChangeResponse } from './ChangeResponse';

export function ChangeDetailView({
  changeId,
  forStakeholder,
}: {
  readonly changeId: string;
  readonly forStakeholder: string | null;
}) {
  const load = useCallback(
    (signal: AbortSignal) => getChange(changeId, signal),
    [changeId],
  );
  const { data, error, loading, reload } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: changeId,
  });

  if (loading && !data) return <Loading />;
  if (!data)
    return <LoadError message={error ?? 'No encontramos este cambio.'} />;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <nav className="text-sm">
        <Link href="/sala" className={textLink}>
          ← Volver a la sala
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
        forStakeholder={forStakeholder}
        response={
          <ChangeResponse
            change={data}
            forStakeholder={forStakeholder}
            onDone={reload}
          />
        }
      />
    </article>
  );
}
