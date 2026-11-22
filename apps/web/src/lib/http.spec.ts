import { describe, expect, it } from 'vitest';

import { ApiError, buildHeaders, describeError, parseError } from './http';

describe('buildHeaders', () => {
  it('manda el id de acción y el tipo del cuerpo', () => {
    const headers = buildHeaders({ body: {}, write: true });
    expect(headers['x-action-id']).toMatch(/[0-9a-f-]{36}/);
    expect(headers['content-type']).toBe('application/json');
  });

  it('no manda lo que no hay', () => {
    expect(buildHeaders({})).toEqual({ accept: 'application/json' });
  });
});

describe('parseError', () => {
  it('lee el código del cuerpo', () => {
    const error = parseError(409, JSON.stringify({ code: 'already_member' }));
    expect(error.code).toBe('already_member');
    expect(error.status).toBe(409);
  });

  it('acepta el código como mensaje de Nest', () => {
    const error = parseError(
      409,
      JSON.stringify({ statusCode: 409, message: 'already_member' }),
    );
    expect(error.code).toBe('already_member');
  });

  it('tolera cuerpos que no son JSON', () => {
    const error = parseError(502, 'Bad gateway');
    expect(error.code).toBeNull();
    expect(error.message).toBe('Error 502');
  });
});

describe('describeError', () => {
  it('traduce los errores conocidos', () => {
    expect(describeError(new ApiError(409, 'already_member', ''))).toContain(
      'ya es parte',
    );
    expect(describeError(new ApiError(403, 'not_on_team', ''))).toContain(
      'equipo de este proyecto',
    );
    expect(describeError(new ApiError(403, null, 'x'))).toContain('no te toca');
    expect(describeError(new TypeError('fetch failed'))).toContain('conexión');
  });
});
