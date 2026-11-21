'use client';

import { Card } from '@team27/ui';
import { useCallback } from 'react';

import { Loading, LoadError } from '@/components/common/LoadState';
import { useLive } from '@/hooks/use-live';
import { getProvenance } from '@/lib/provenance-api';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';

import { ProvenanceChain } from './ProvenanceChain';

export function ValuePage({
  subjectId,
  attribute,
}: {
  readonly subjectId: string;
  readonly attribute: string;
}) {
  const load = useCallback(
    (signal: AbortSignal) => getProvenance(subjectId, attribute, signal),
    [subjectId, attribute],
  );
  const { data, error, loading } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: `${subjectId}/${attribute}`,
  });

  return (
    <Card title="¿De dónde salió este valor?">
      {loading && <Loading />}
      {error && !data && <LoadError message={error} />}
      {data && <ProvenanceChain provenance={data} />}
    </Card>
  );
}
