'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  clearPresenterKey,
  readPresenterKey,
  savePresenterKey,
} from '@/lib/seat-storage';

export interface PresenterKey {
  readonly ready: boolean;
  readonly key: string | null;
  readonly save: (key: string) => void;
  readonly forget: () => void;
}

export const usePresenterKey = (): PresenterKey => {
  const [state, setState] = useState<{ ready: boolean; key: string | null }>({
    ready: false,
    key: null,
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setState({ ready: true, key: readPresenterKey() }),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  const save = useCallback((key: string) => {
    savePresenterKey(key);
    setState({ ready: true, key });
  }, []);

  const forget = useCallback(() => {
    clearPresenterKey();
    setState({ ready: true, key: null });
  }, []);

  return { ...state, save, forget };
};
