'use client';

import { useCallback } from 'react';

import { getFlowHistory, type FlowHistory } from '@/lib/flow-history-api';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';

import { useLive, type Live } from './use-live';

export const useFlowHistory = ({
  key,
  enabled = true,
}: {
  readonly key: string;
  readonly enabled?: boolean;
}): Live<FlowHistory> => {
  const load = useCallback((signal: AbortSignal) => getFlowHistory(signal), []);
  return useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: key,
    enabled,
  });
};
