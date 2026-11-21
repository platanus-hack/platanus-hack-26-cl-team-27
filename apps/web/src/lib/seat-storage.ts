export const SEAT_STORAGE_ERROR = 'Tu navegador no deja guardar el asiento';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

const SEAT_PREFIX = 'sala:asiento:';
const PRESENTER_KEY = 'sala:presentador';

const memorySeats = new Map<string, string>();

export const localStore = (): StorageLike | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const sessionStore = (): StorageLike | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

export const readSeatToken = (
  castId: string,
  storage: StorageLike | null = localStore(),
): string | null => {
  try {
    const stored = storage?.getItem(SEAT_PREFIX + castId) ?? null;
    if (stored) return stored;
  } catch {
    return memorySeats.get(castId) ?? null;
  }
  return memorySeats.get(castId) ?? null;
};

export const saveSeatToken = (
  castId: string,
  token: string,
  storage: StorageLike | null = localStore(),
): boolean => {
  memorySeats.set(castId, token);
  try {
    if (!storage) return false;
    storage.setItem(SEAT_PREFIX + castId, token);
    return true;
  } catch {
    return false;
  }
};

export const clearSeatToken = (
  castId: string,
  storage: StorageLike | null = localStore(),
): void => {
  memorySeats.delete(castId);
  try {
    storage?.removeItem(SEAT_PREFIX + castId);
  } catch {
    return;
  }
};

export const heldSeatIds = (
  storage: StorageLike | null = localStore(),
): string[] => {
  const ids = new Set(memorySeats.keys());
  try {
    for (let index = 0; storage && index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(SEAT_PREFIX)) ids.add(key.slice(SEAT_PREFIX.length));
    }
  } catch {
    return [...ids];
  }
  return [...ids];
};

export const clearAllSeatTokens = (
  storage: StorageLike | null = localStore(),
): void => {
  for (const castId of heldSeatIds(storage)) clearSeatToken(castId, storage);
};

export const readPresenterKey = (
  storage: StorageLike | null = sessionStore(),
): string | null => {
  try {
    return storage?.getItem(PRESENTER_KEY) ?? null;
  } catch {
    return null;
  }
};

export const savePresenterKey = (
  key: string,
  storage: StorageLike | null = sessionStore(),
): boolean => {
  try {
    if (!storage) return false;
    storage.setItem(PRESENTER_KEY, key);
    return true;
  } catch {
    return false;
  }
};

export const clearPresenterKey = (
  storage: StorageLike | null = sessionStore(),
): void => {
  try {
    storage?.removeItem(PRESENTER_KEY);
  } catch {
    return;
  }
};

export const resetSeatMemory = (): void => {
  memorySeats.clear();
};
