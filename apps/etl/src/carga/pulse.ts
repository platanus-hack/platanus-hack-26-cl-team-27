import type { Http } from './http.ts';
import { sleep } from './http.ts';

export const FLOW_INTERVAL_MS = 1000;
export const SALA_INTERVAL_MS = 700;
export const JITTER_MS = 150;
export const FIRST_BACKOFF_MS = 2000;
export const BACKOFF_CAP_MS = 3000;
export const LONG_POLL_GAP_MS = 100;
export const DEFAULT_WAIT_SECONDS = 10;
export const LONG_POLL_MARGIN_MS = 10_000;

export const pulseDelay = (
  baseMs: number,
  failures: number,
  random: () => number = Math.random,
  longPoll = false,
): number => {
  if (longPoll && failures === 0) {
    return Math.floor(random() * (LONG_POLL_GAP_MS + 1));
  }
  if (failures === 0) return baseMs + (random() * 2 - 1) * JITTER_MS;
  return failures === 1 ? FIRST_BACKOFF_MS : BACKOFF_CAP_MS;
};

export interface PulseSeat {
  readonly castId: string;
  readonly token: string;
}

interface EventsReply {
  readonly epoch: number;
  readonly cursor: number;
  readonly reset: boolean;
  readonly longPoll?: boolean;
  readonly events: readonly { readonly seq: number }[];
}

const isEventsReply = (data: unknown): data is EventsReply =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as EventsReply).epoch === 'number' &&
  typeof (data as EventsReply).cursor === 'number' &&
  Array.isArray((data as EventsReply).events);

export class Pulse {
  private epoch: number | null = null;
  private cursor: number | null = null;
  private failures = 0;
  private longPoll = false;
  private readonly http: Http;
  private readonly intervalMs: number;
  private readonly seat: PulseSeat | null;
  private readonly waitSeconds: number;

  constructor(
    http: Http,
    intervalMs: number,
    seat: PulseSeat | null = null,
    waitSeconds: number = DEFAULT_WAIT_SECONDS,
  ) {
    this.http = http;
    this.intervalMs = intervalMs;
    this.seat = seat;
    this.waitSeconds = waitSeconds;
  }

  private currentWait(): number {
    const synced = this.cursor !== null && this.epoch !== null;
    return this.longPoll && synced ? this.waitSeconds : 0;
  }

  private path(wait: number): string {
    const params = new URLSearchParams();
    if (this.cursor !== null) params.set('after', String(this.cursor));
    if (this.epoch !== null) params.set('epoch', String(this.epoch));
    if (this.seat) params.set('seat', this.seat.castId);
    if (wait > 0) params.set('wait', String(wait));
    const query = params.toString();
    return `/events${query ? `?${query}` : ''}`;
  }

  async tick(signal?: AbortSignal): Promise<boolean> {
    const wait = this.currentWait();
    const reply = await this.http.call({
      label: '/events',
      path: this.path(wait),
      ...(signal ? { signal } : {}),
      ...(wait > 0 ? { timeoutMs: wait * 1000 + LONG_POLL_MARGIN_MS } : {}),
      ...(this.seat ? { seatToken: this.seat.token } : {}),
    });
    if (!reply.ok || !isEventsReply(reply.data)) {
      this.failures += 1;
      return false;
    }
    this.failures = 0;
    const data = reply.data;
    this.longPoll = this.waitSeconds > 0 && data.longPoll === true;
    const synced = this.cursor !== null && this.epoch !== null;
    const reset = synced && (data.reset || data.epoch !== this.epoch);
    const known = this.cursor ?? -1;
    const fresh = data.events.filter((event) => event.seq > known);
    const last = fresh.reduce((max, event) => Math.max(max, event.seq), 0);
    this.epoch = data.epoch;
    this.cursor = reset
      ? data.cursor
      : Math.max(this.cursor ?? 0, data.cursor, last);
    return !synced || reset || fresh.length > 0;
  }

  async run(onChange: () => Promise<void>, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      if (await this.tick(signal)) await onChange();
      await sleep(
        pulseDelay(this.intervalMs, this.failures, Math.random, this.longPoll),
        signal,
      );
    }
  }
}
