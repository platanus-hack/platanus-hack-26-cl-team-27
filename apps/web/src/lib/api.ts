import 'server-only';

const apiUrl = (): string => process.env['API_URL'] ?? 'http://localhost:3001';

export interface ApiStatus {
  readonly api: 'ok' | 'down';
  readonly database: 'ok' | 'error' | 'unknown';
}

export const getApiStatus = async (): Promise<ApiStatus> => {
  try {
    const response = await fetch(`${apiUrl()}/api/health/ready`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    return { api: 'ok', database: response.ok ? 'ok' : 'error' };
  } catch {
    return { api: 'down', database: 'unknown' };
  }
};
