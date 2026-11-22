import { randomUUID } from 'node:crypto';

import type { Metrics } from './stats.ts';

export const REQUEST_TIMEOUT_MS = 10_000;

export interface CallOptions {
  readonly label: string;
  readonly method?: 'GET' | 'POST' | 'DELETE';
  readonly path: string;
  readonly seatToken?: string;
  readonly presenterKey?: string;
  readonly body?: unknown;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface Reply {
  readonly ok: boolean;
  readonly status: number;
  readonly error: string | null;
  readonly data: unknown;
}

export class Http {
  private readonly base: string;
  private readonly metrics: Metrics;

  constructor(base: string, metrics: Metrics) {
    this.base = base;
    this.metrics = metrics;
  }

  async call(options: CallOptions): Promise<Reply> {
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.body !== undefined)
      headers['content-type'] = 'application/json';
    if (options.seatToken) headers['x-seat-token'] = options.seatToken;
    if (options.presenterKey) headers['x-presenter-key'] = options.presenterKey;
    if (method !== 'GET') headers['x-action-id'] = randomUUID();
    const started = performance.now();
    let reply: Reply;
    try {
      const response = await fetch(`${this.base}${options.path}`, {
        method,
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: 'no-store',
        signal: AbortSignal.any([
          AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
          ...(options.signal ? [options.signal] : []),
        ]),
      });
      const text = await response.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      reply = {
        ok: response.ok,
        status: response.status,
        error: response.ok ? null : String(response.status),
        data,
      };
    } catch (error) {
      if (options.signal?.aborted) {
        return { ok: false, status: 0, error: 'abortado', data: null };
      }
      const timeout = error instanceof Error && error.name === 'TimeoutError';
      reply = {
        ok: false,
        status: 0,
        error: timeout ? 'timeout' : 'red',
        data: null,
      };
    }
    this.metrics.record(
      `${method} ${options.label}`,
      performance.now() - started,
      reply.error,
    );
    return reply;
  }
}

export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const done = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
