import { localStore, type StorageLike } from './seat-storage';

const WAITING_PREFIX = 'sala:esperando:';

export const isWaiting = (
  discrepancyId: string,
  storage: StorageLike | null = localStore(),
): boolean => {
  try {
    return storage
      ? storage.getItem(WAITING_PREFIX + discrepancyId) !== null
      : false;
  } catch {
    return false;
  }
};

export const setWaiting = (
  discrepancyId: string,
  waiting: boolean,
  storage: StorageLike | null = localStore(),
): boolean => {
  try {
    if (!storage) return false;
    if (waiting) storage.setItem(WAITING_PREFIX + discrepancyId, '1');
    else storage.removeItem(WAITING_PREFIX + discrepancyId);
    return true;
  } catch {
    return false;
  }
};
