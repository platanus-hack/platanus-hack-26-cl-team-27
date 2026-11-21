'use client';

import { useCallback } from 'react';

import { useResource } from '@/hooks/use-resource';
import { getProposals } from '@/lib/proposals-api';

export const useChangeIds = (
  refreshKey: string | number,
): ((proposalId: string) => string | null) => {
  const load = useCallback(
    (signal: AbortSignal) => getProposals(undefined, signal),
    [],
  );
  const { data } = useResource(load, String(refreshKey));
  return useCallback(
    (proposalId: string) =>
      data?.proposals.find((proposal) => proposal.id === proposalId)
        ?.changeId ?? null,
    [data],
  );
};
