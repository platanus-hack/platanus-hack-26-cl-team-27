'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { describeError, isAbort } from '@/lib/http';
import type { ProjectEvent } from '@/lib/events-api';

import { useProjectPulse, type PulseStatus } from './use-project-pulse';

export interface LiveOptions<T> {
  readonly load: (signal: AbortSignal) => Promise<T>;
  readonly intervalMs: number;
  readonly dependencyKey?: string;
  readonly projectId?: string | null;
  readonly onReset?: () => void;
}

export interface Live<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly loading: boolean;
  readonly events: readonly ProjectEvent[];
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
  projectId = null,
  onReset,
}: LiveOptions<T>): Live<T> => {
  const [slot, setSlot] = useState<Slot<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const loader = useRef(load);
  const current = useRef<AbortController | null>(null);

  useEffect(() => {
    loader.current = load;
  });

  const reload = useCallback(() => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    loader
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setSlot({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setSlot((previous) => ({
          data: previous.data,
          error: describeError(error),
          loading: false,
        }));
      });
  }, []);

  useEffect(() => {
    reload();
    return () => current.current?.abort();
  }, [reload, dependencyKey]);

  const { events, status } = useProjectPulse({
    projectId,
    intervalMs,
    onEvents: reload,
    onReset: () => {
      if (onReset) onReset();
      else reload();
    },
  });

  return { ...slot, events, status, reload };
};
