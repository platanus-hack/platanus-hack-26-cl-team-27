import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  buildHeaders,
  describeError,
  isAbort,
  newActionId,
  parseError,
  request,
  RequestTimeoutError,
  withDeadline,
} from './http';

describe('buildHeaders', () => {
  it('manda el token del asiento, la clave y el id de acción', () => {
    const headers = buildHeaders({
      seatToken: 'tok',
      presenterKey: 'key',
      body: {},
      write: true,
    });
    expect(headers['x-seat-token']).toBe('tok');
    expect(headers['x-presenter-key']).toBe('key');
    expect(headers['x-action-id']).toMatch(/[0-9a-f-]{36}/);
    expect(headers['content-type']).toBe('application/json');
  });

  it('no manda lo que no hay', () => {
    expect(buildHeaders({})).toEqual({ accept: 'application/json' });
  });
});

describe('parseError', () => {
  it('lee el código del cuerpo', () => {
    const error = parseError(409, JSON.stringify({ code: 'seat_taken' }));
    expect(error.code).toBe('seat_taken');
    expect(error.status).toBe(409);
  });

  it('acepta el código como mensaje de Nest', () => {
    const error = parseError(
      409,
      JSON.stringify({ statusCode: 409, message: 'seat_taken' }),
    );
    expect(error.code).toBe('seat_taken');
  });

  it('tolera cuerpos que no son JSON', () => {
    const error = parseError(502, 'Bad gateway');
    expect(error.code).toBeNull();
    expect(error.message).toBe('Error 502');
  });
});

describe('describeError', () => {
  it('traduce los errores conocidos', () => {
    expect(describeError(new ApiError(409, 'seat_taken', ''))).toContain(
      'se te adelantó',
    );
    expect(describeError(new ApiError(409, 'seat_held', ''))).toContain(
      'otra persona',
    );
    expect(describeError(new ApiError(403, null, 'x'))).toContain(
      'no le toca a tu asiento',
    );
    expect(describeError(new TypeError('fetch failed'))).toContain('conexión');
  });
});

describe('newActionId', () => {
  it('usa randomUUID si existe', () => {
    expect(
      newActionId({ randomUUID: () => 'fijo', getRandomValues: (a) => a }),
    ).toBe('fijo');
  });

  it('arma un UUID v4 con getRandomValues si falta randomUUID', () => {
    const id = newActionId({
      getRandomValues: (array) => {
        (array as unknown as Uint8Array).fill(255);
        return array;
      },
    });
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe('withDeadline', () => {
  afterEach(() => vi.useRealTimers());

  it('aborta y avisa al vencer el plazo', () => {
    vi.useFakeTimers();
    const deadline = withDeadline(undefined, 10_000);
    vi.advanceTimersByTime(9_999);
    expect(deadline.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut()).toBe(true);
  });

  it('propaga la señal del llamador sin contar como timeout', () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const deadline = withDeadline(caller.signal);
    caller.abort();
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut()).toBe(false);
    deadline.dispose();
  });

  it('no aborta tras dispose', () => {
    vi.useFakeTimers();
    const deadline = withDeadline(undefined, 100);
    deadline.dispose();
    vi.advanceTimersByTime(500);
    expect(deadline.signal.aborted).toBe(false);
  });
});

describe('request', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('lanza RequestTimeoutError si la respuesta no llega', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      (_path: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('abort', 'AbortError')),
          );
        }),
    );
    const result = request('/api/x').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await result;
    expect(error).toBeInstanceOf(RequestTimeoutError);
    expect(isAbort(error)).toBe(false);
  });

  it('una escritura espera 30 s antes de vencer y su vencimiento tiene su propio mensaje', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      (_path: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('abort', 'AbortError')),
          );
        }),
    );
    let settled = false;
    const result = request('/api/x', { method: 'POST', body: {} })
      .catch((error: unknown) => error)
      .finally(() => {
        settled = true;
      });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(20_000);
    const error = await result;
    expect(error).toBeInstanceOf(RequestTimeoutError);
    expect(describeError(error)).toMatch(/tardó más de lo normal/);
  });
});
