'use client';

import { useSyncExternalStore } from 'react';

const TICK_MS = 15_000;

let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (timer === null) {
    timer = setInterval(() => {
      now = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
};

const snapshot = () => {
  if (now === 0) now = Date.now();
  return now;
};

const serverSnapshot = () => 0;

export const useNow = (): number =>
  useSyncExternalStore(subscribe, snapshot, serverSnapshot);
