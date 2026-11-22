import type { Http } from './http.ts';
import { sleep } from './http.ts';

export const FLOW_INTERVAL_MS = 1000;
export const SALA_INTERVAL_MS = 700;
export const JITTER_MS = 150;
export const FIRST_BACKOFF_MS = 2000;
export const BACKOFF_CAP_MS = 3000;

export const pulseDelay = (
  baseMs: number,
  failures: number,
  random: () => number = Math.random,
): number => {
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
  private readonly http: Http;
  private readonly intervalMs: number;
  private readonly seat: PulseSeat | null;

  constructor(http: Http, intervalMs: number, seat: PulseSeat | null = null) {
    this.http = http;
    this.intervalMs = intervalMs;
    this.seat = seat;
  }

  private path(): string {
    const params = new URLSearchParams();
    if (this.cursor !== null) params.set('after', String(this.cursor));
    if (this.epoch !== null) params.set('epoch', String(this.epoch));
    if (this.seat) params.set('seat', this.seat.castId);
    const query = params.toString();
    return `/events${query ? `?${query}` : ''}`;
  }

  async tick(): Promise<boolean> {
    const reply = await this.http.call({
      label: '/events',
      path: this.path(),
      ...(this.seat ? { seatToken: this.seat.token } : {}),
    });
    if (!reply.ok || !isEventsReply(reply.data)) {
      this.failures += 1;
      return false;
    }
    this.failures = 0;
    const data = reply.data;
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
      if (await this.tick()) await onChange();
      await sleep(pulseDelay(this.intervalMs, this.failures), signal);
    }
  }
}
