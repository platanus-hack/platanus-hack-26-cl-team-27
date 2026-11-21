'use client';

import { useCallback, useEffect, useState } from 'react';

import { heldSeatIds, readSeatToken } from '@/lib/seat-storage';

export interface HeldSeats {
  readonly ready: boolean;
  readonly ids: readonly string[];
  readonly tokenFor: (castId: string) => string | null;
  readonly refresh: () => void;
}

export const useHeldSeats = (): HeldSeats => {
  const [ids, setIds] = useState<readonly string[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setIds(heldSeatIds());
    setReady(true);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(refresh);
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  const tokenFor = useCallback((castId: string) => readSeatToken(castId), []);

  return { ready, ids, tokenFor, refresh };
};

export const useSeatToken = (
  castId: string,
): { readonly ready: boolean; readonly token: string | null } => {
  const [state, setState] = useState<{
    ready: boolean;
    token: string | null;
  }>({ ready: false, token: null });

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setState({ ready: true, token: readSeatToken(castId) }),
    );
    return () => cancelAnimationFrame(frame);
  }, [castId]);

  return state;
};

