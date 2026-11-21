import { describe, expect, it } from 'vitest';

import type { StorageLike } from './seat-storage';
import { isWaiting, setWaiting } from './waiting';

const fakeStorage = (broken = false): StorageLike => {
  const data = new Map<string, string>();
  const guard = () => {
    if (broken) throw new DOMException('denegado', 'SecurityError');
  };
  return {
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => {
      guard();
      return data.get(key) ?? null;
    },
    setItem: (key, value) => {
      guard();
      data.set(key, value);
    },
    removeItem: (key) => {
      guard();
      data.delete(key);
    },
  };
};

describe('esperar el plano', () => {
  it('recuerda y olvida la espera de una discrepancia', () => {
    const storage = fakeStorage();
    expect(isWaiting('d1', storage)).toBe(false);
    expect(setWaiting('d1', true, storage)).toBe(true);
    expect(isWaiting('d1', storage)).toBe(true);
    expect(isWaiting('d2', storage)).toBe(false);
    setWaiting('d1', false, storage);
    expect(isWaiting('d1', storage)).toBe(false);
  });

  it('no falla si el navegador no deja guardar', () => {
    const storage = fakeStorage(true);
    expect(setWaiting('d1', true, storage)).toBe(false);
    expect(isWaiting('d1', storage)).toBe(false);
    expect(isWaiting('d1', null)).toBe(false);
  });
});
