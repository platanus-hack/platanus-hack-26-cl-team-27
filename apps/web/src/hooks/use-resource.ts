'use client';

import { useEffect, useRef, useState } from 'react';

import { describeError, isAbort } from '@/lib/http';

export interface Resource<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly ready: boolean;
}

export const useResource = <T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: string,
): Resource<T> => {
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string | null;
  }>({ key: '', data: null, error: null });
  const loader = useRef(load);

  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    loader
      .current(controller.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setState((previous) => ({
          key,
          data: previous.data,
          error: describeError(error),
        }));
      });
    return () => controller.abort();
  }, [key]);

  return {
    data: state.data,
    error: state.error,
    ready: state.key === key || state.data !== null,
  };
};
