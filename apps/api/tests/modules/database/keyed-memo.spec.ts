import { KeyedMemo } from '../../../src/modules/database/keyed-memo.ts';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((ok) => {
    resolve = ok;
  });
  return { promise, resolve };
};

describe('KeyedMemo', () => {
  it('calcula una sola vez con 30 peticiones simultáneas de la misma clave', async () => {
    const memo = new KeyedMemo<number>();
    const gate = deferred<void>();
    let calls = 0;
    const compute = async () => {
      calls += 1;
      await gate.promise;
      return { key: 'a', value: 42 };
    };

    const all = Promise.all(
      Array.from({ length: 30 }, () => memo.get('a', compute)),
    );
    gate.resolve();

    expect(await all).toEqual(Array.from({ length: 30 }, () => 42));
    expect(calls).toBe(1);
  });

  it('sirve de la caché sin volver a calcular', async () => {
    const memo = new KeyedMemo<string>();
    let calls = 0;
    const compute = () => {
      calls += 1;
      return Promise.resolve({ key: 'a', value: `v${calls}` });
    };

    await memo.get('a', compute);
    await expect(memo.get('a', compute)).resolves.toBe('v1');
    expect(calls).toBe(1);
  });

  it('calcula por separado cada clave', async () => {
    const memo = new KeyedMemo<string>();

    const [a, b] = await Promise.all([
      memo.get('a', () => Promise.resolve({ key: 'a', value: 'A' })),
      memo.get('b', () => Promise.resolve({ key: 'b', value: 'B' })),
    ]);

    expect([a, b]).toEqual(['A', 'B']);
  });

  it('no cachea los errores: todos los que esperaban fallan y el siguiente reintenta', async () => {
    const memo = new KeyedMemo<number>();
    const gate = deferred<void>();
    let calls = 0;
    const failing = async (): Promise<{ key: string; value: number }> => {
      calls += 1;
      await gate.promise;
      throw new Error('falló');
    };

    const waiting = Array.from({ length: 5 }, () =>
      memo.get('a', failing).then(
        () => 'ok',
        (error: Error) => error.message,
      ),
    );
    gate.resolve();

    expect(await Promise.all(waiting)).toEqual(
      Array.from({ length: 5 }, () => 'falló'),
    );
    expect(calls).toBe(1);
    await expect(
      memo.get('a', () => Promise.resolve({ key: 'a', value: 7 })),
    ).resolves.toBe(7);
  });

  it('guarda el resultado bajo la clave que devolvió el cálculo', async () => {
    const memo = new KeyedMemo<string>();
    await memo.get('vieja', () =>
      Promise.resolve({ key: 'nueva', value: 'X' }),
    );
    let calls = 0;

    const value = await memo.get('nueva', () => {
      calls += 1;
      return Promise.resolve({ key: 'nueva', value: 'Y' });
    });

    expect(value).toBe('X');
    expect(calls).toBe(0);
  });

  it('descarta las claves más viejas al pasar la capacidad', async () => {
    const memo = new KeyedMemo<number>(2);
    const put = (key: string, value: number) =>
      memo.get(key, () => Promise.resolve({ key, value }));
    await put('a', 1);
    await put('b', 2);
    await put('c', 3);

    await expect(put('a', 10)).resolves.toBe(10);
    await expect(put('c', 30)).resolves.toBe(3);
  });
});
