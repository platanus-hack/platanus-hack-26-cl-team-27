'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback } from 'react';

import { Drawer } from '@/components/common/Drawer';
import { Loading, LoadError } from '@/components/common/LoadState';
import { textLink } from '@/components/common/link-styles';
import {
  ProvenanceChain,
  ProvenanceSummary,
} from '@/components/valor/ProvenanceChain';
import { useChangeIds } from '@/components/valor/use-change-ids';
import { useResource } from '@/hooks/use-resource';
import { getProvenance, valuePath } from '@/lib/provenance-api';

export interface ValueRef {
  readonly subjectId: string;
  readonly attribute: string;
}

export function ProvenanceDrawer({
  value,
  refreshKey,
  onClose,
}: {
  readonly value: ValueRef;
  readonly refreshKey: string | number;
  readonly onClose: () => void;
}) {
  const load = useCallback(
    (signal: AbortSignal) =>
      getProvenance(value.subjectId, value.attribute, signal),
    [value.subjectId, value.attribute],
  );
  const { data, error, ready } = useResource(
    load,
    `${value.subjectId}/${value.attribute}:${refreshKey}`,
  );
  const changeIdOf = useChangeIds(refreshKey);

  return (
    <Drawer
      eyebrow="Procedencia"
      title="¿De dónde salió este valor?"
      onClose={onClose}
    >
      {!ready && <Loading />}
      {error && !data && <LoadError message={error} />}
      {data && (
        <div className="flex flex-col gap-6">
          <ProvenanceSummary provenance={data} />
          <ProvenanceChain provenance={data} changeIdOf={changeIdOf} />
          <Link
            href={valuePath(value.subjectId, value.attribute) as Route}
            className={`${textLink} text-sm`}
          >
            Abrir la procedencia completa →
          </Link>
        </div>
      )}
    </Drawer>
  );
}
