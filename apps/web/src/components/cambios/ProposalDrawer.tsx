'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useState, type ReactNode } from 'react';

import { Drawer } from '@/components/common/Drawer';
import { Loading, LoadError } from '@/components/common/LoadState';
import { textLink } from '@/components/common/link-styles';
import { useResource } from '@/hooks/use-resource';
import { getChange } from '@/lib/changes-api';

import { ChangeDetailBody, changeTitle } from './ChangeDetailBody';
import { ChangeResponse } from './ChangeResponse';

export const changePath = (changeId: string, forStakeholder?: string | null) =>
  `/cambios/${changeId}${forStakeholder ? `?para=${encodeURIComponent(forStakeholder)}` : ''}`;

export function ProposalDrawer({
  changeId,
  forStakeholder = null,
  refreshKey,
  onClose,
  onChanged,
  footer,
  respond = true,
}: {
  readonly changeId: string;
  readonly forStakeholder?: string | null;
  readonly refreshKey: string | number;
  readonly onClose: () => void;
  readonly onChanged?: () => void;
  readonly footer?: ReactNode;
  readonly respond?: boolean;
}) {
  const [bump, setBump] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) => getChange(changeId, signal),
    [changeId],
  );
  const { data, error, ready } = useResource(
    load,
    `${changeId}:${refreshKey}:${bump}`,
  );
  const done = () => {
    setBump((value) => value + 1);
    onChanged?.();
  };

  return (
    <Drawer
      eyebrow="Propuesta de cambio"
      title={data ? changeTitle(data) : 'Cargando…'}
      onClose={onClose}
      footer={footer}
    >
      {!ready && <Loading />}
      {error && !data && <LoadError message={error} />}
      {data && (
        <div className="flex flex-col gap-5">
          <ChangeDetailBody
            change={data}
            forStakeholder={forStakeholder}
            response={
              respond ? (
                <ChangeResponse
                  change={data}
                  forStakeholder={forStakeholder}
                  onDone={done}
                />
              ) : null
            }
          />
          <Link
            href={changePath(changeId, forStakeholder) as Route}
            className={`${textLink} text-sm`}
          >
            Abrir como página para compartir →
          </Link>
        </div>
      )}
    </Drawer>
  );
}
