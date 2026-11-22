'use client';

import { useCallback } from 'react';

import { useProjectId } from '@/components/proyectos/ProjectContext';
import { useResource } from '@/hooks/use-resource';
import { getProposals } from '@/lib/proposals-api';

export const useChangeIds = (
  refreshKey: string | number,
): ((proposalId: string) => string | null) => {
  const projectId = useProjectId();
  const load = useCallback(
    (signal: AbortSignal) => getProposals(projectId, undefined, signal),
    [projectId],
  );
  const { data } = useResource(load, `${projectId}:${refreshKey}`);
  return useCallback(
    (proposalId: string) =>
      data?.proposals.find((proposal) => proposal.id === proposalId)
        ?.changeId ?? null,
    [data],
  );
};
