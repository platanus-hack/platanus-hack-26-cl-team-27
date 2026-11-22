'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { describeError, isAbort } from '@/lib/http';
import type { RoomEvent } from '@/lib/events-api';
import { reloadDelay, retryDelay } from '@/lib/pulse';

import { useRoomPulse, type PulseStatus } from './use-room-pulse';

export interface LiveOptions<T> {
  readonly load: (signal: AbortSignal) => Promise<T>;
  readonly intervalMs: number;
  readonly dependencyKey?: string;
  readonly castId?: string | null;
  readonly seatToken?: string | null;
  readonly enabled?: boolean;
  readonly poll?: boolean;
  readonly onReset?: () => void;
}

export interface Live<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly loading: boolean;
  readonly events: readonly RoomEvent[];
  readonly status: PulseStatus;
  readonly reload: () => void;
}

interface Slot<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly loading: boolean;
}

export const useLive = <T>({
  load,
  intervalMs,
  dependencyKey = '',
  castId = null,
  seatToken = null,
  enabled = true,
  poll = true,
  onReset,
}: LiveOptions<T>): Live<T> => {
  const [slot, setSlot] = useState<Slot<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const loader = useRef(load);
  const current = useRef<AbortController | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempts = useRef(0);
  const retryWaiting = useRef(false);

  useEffect(() => {
    loader.current = load;
  });

  const clearTimers = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    reloadTimer.current = null;
    retryTimer.current = null;
    retryWaiting.current = false;
  }, []);

  const reload = useCallback(() => {
    current.current?.abort();
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
    retryWaiting.current = false;
    const controller = new AbortController();
    current.current = controller;
    loader
      .current(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        attempts.current = 0;
        setSlot({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setSlot((previous) => ({
          data: previous.data,
          error: describeError(error),
          loading: false,
        }));
        const delay = retryDelay(attempts.current);
        attempts.current += 1;
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          if (document.hidden) retryWaiting.current = true;
          else reload();
        }, delay);
      });
  }, []);

  const reloadSoon = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      reloadTimer.current = null;
      reload();
    }, reloadDelay());
  }, [reload]);

  useEffect(() => {
    attempts.current = 0;
    reload();
    const onVisibility = () => {
      if (!document.hidden && retryWaiting.current) reload();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimers();
      current.current?.abort();
    };
  }, [reload, clearTimers, dependencyKey]);

  const { events, status } = useRoomPulse({
    intervalMs,
    castId,
    seatToken,
    enabled: enabled && poll,
    onEvents: reloadSoon,
    onReset: () => {
      if (onReset) onReset();
      else reloadSoon();
    },
  });

  return { ...slot, events, status, reload };
};
