import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearAllSeatTokens,
  clearPresenterKey,
  clearSeatToken,
  heldSeatIds,
  readPresenterKey,
  readSeatToken,
  resetSeatMemory,
  saveSeatToken,
  savePresenterKey,
  type StorageLike,
} from './seat-storage';

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

beforeEach(() => {
  resetSeatMemory();
});

describe('token del asiento', () => {
  it('guarda y lee por id del elenco', () => {
    const storage = fakeStorage();
    expect(saveSeatToken('paula-rojas', 'abc', storage)).toBe(true);
    expect(readSeatToken('paula-rojas', storage)).toBe('abc');
    expect(readSeatToken('marcos-fuentes', storage)).toBeNull();
  });

  it('lista los asientos tomados y los suelta', () => {
    const storage = fakeStorage();
    saveSeatToken('paula-rojas', 'a', storage);
    saveSeatToken('tomas-reyes', 'b', storage);
    expect(heldSeatIds(storage).sort()).toEqual(['paula-rojas', 'tomas-reyes']);
    clearSeatToken('paula-rojas', storage);
    expect(heldSeatIds(storage)).toEqual(['tomas-reyes']);
    clearAllSeatTokens(storage);
    expect(heldSeatIds(storage)).toEqual([]);
  });

  it('sin almacenamiento sigue funcionando en memoria y avisa que no persistió', () => {
    const storage = fakeStorage(true);
    expect(saveSeatToken('paula-rojas', 'abc', storage)).toBe(false);
    expect(readSeatToken('paula-rojas', storage)).toBe('abc');
    expect(saveSeatToken('camila-vera', 'x', null)).toBe(false);
  });

  it('un almacenamiento roto no tira excepciones al soltar', () => {
    const storage = fakeStorage(true);
    expect(() => clearSeatToken('paula-rojas', storage)).not.toThrow();
    expect(() => clearAllSeatTokens(storage)).not.toThrow();
  });
});

describe('clave del presentador', () => {
  it('se guarda y se borra', () => {
    const storage = fakeStorage();
    expect(readPresenterKey(storage)).toBeNull();
    expect(savePresenterKey('clave', storage)).toBe(true);
    expect(readPresenterKey(storage)).toBe('clave');
    clearPresenterKey(storage);
    expect(readPresenterKey(storage)).toBeNull();
  });

  it('tolera un almacenamiento roto', () => {
    const storage = fakeStorage(true);
    expect(savePresenterKey('clave', storage)).toBe(false);
    expect(readPresenterKey(storage)).toBeNull();
  });
});
