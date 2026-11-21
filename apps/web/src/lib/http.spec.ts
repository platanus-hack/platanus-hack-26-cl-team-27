import { describe, expect, it } from 'vitest';

import { ApiError, buildHeaders, describeError, parseError } from './http';

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
      JSON.stringify({ statusCode: 409, message: 'already_ingested' }),
    );
    expect(error.code).toBe('already_ingested');
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
    expect(describeError(new ApiError(403, null, 'x'))).toContain(
      'no es de tu',
    );
    expect(describeError(new TypeError('fetch failed'))).toContain('conexión');
  });
});
