'use client';

import { useCallback } from 'react';

import { getFlow, type FlowState } from '@/lib/flow-api';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';

import { useLive, type Live } from './use-live';

export const useFlow = ({
  castId = null,
  seatToken = null,
  enabled = true,
}: {
  readonly castId?: string | null;
  readonly seatToken?: string | null;
  readonly enabled?: boolean;
}): Live<FlowState> => {
  const load = useCallback((signal: AbortSignal) => getFlow(signal), []);
  return useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: `${castId ?? ''}:${seatToken ?? ''}`,
    castId: seatToken ? castId : null,
    seatToken,
    enabled,
  });
};
