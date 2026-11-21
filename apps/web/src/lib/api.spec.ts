import { afterEach, describe, expect, it, vi } from 'vitest';

import { getApiStatus } from './api';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('getApiStatus', () => {
  it('consulta /api/health/ready en API_URL', async () => {
    vi.stubEnv('API_URL', 'http://api.test');
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await expect(getApiStatus()).resolves.toEqual({
      api: 'ok',
      database: 'ok',
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/api/health/ready',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('la API responde pero la base no', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    await expect(getApiStatus()).resolves.toEqual({
      api: 'ok',
      database: 'error',
    });
  });

  it('la API no responde', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );
    await expect(getApiStatus()).resolves.toEqual({
      api: 'down',
      database: 'unknown',
    });
  });
});
