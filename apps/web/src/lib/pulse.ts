import type { EventsResponse, RoomEvent } from './events-api';

export interface PulseState {
  readonly epoch: number | null;
  readonly cursor: number | null;
  readonly events: readonly RoomEvent[];
}

export interface PulseStep {
  readonly state: PulseState;
  readonly fresh: readonly RoomEvent[];
  readonly reset: boolean;
}

export const INITIAL_PULSE: PulseState = {
  epoch: null,
  cursor: null,
  events: [],
};

export const TICKER_LIMIT = 40;
export const BACKOFF_CAP_MS = 3000;
export const JITTER_MS = 150;
export const SALA_INTERVAL_MS = 700;
export const DEFAULT_INTERVAL_MS = 1000;

export const applyPulse = (
  state: PulseState,
  response: EventsResponse,
  limit: number = TICKER_LIMIT,
): PulseStep => {
  const synced = state.cursor !== null && state.epoch !== null;
  const reset = synced && (response.reset || response.epoch !== state.epoch);
  if (reset) {
    return {
      state: { epoch: response.epoch, cursor: response.cursor, events: [] },
      fresh: [],
      reset: true,
    };
  }
  const known = state.cursor ?? -1;
  const fresh = response.events
    .filter((event) => event.seq > known)
    .sort((a, b) => a.seq - b.seq);
  const events = [...fresh].reverse().concat(state.events).slice(0, limit);
  const lastSeq = fresh.length > 0 ? (fresh[fresh.length - 1]?.seq ?? 0) : 0;
  return {
    state: {
      epoch: response.epoch,
      cursor: Math.max(state.cursor ?? 0, response.cursor, lastSeq),
      events,
    },
    fresh: synced ? fresh : [],
    reset: false,
  };
};

export const nextDelay = (
  baseMs: number,
  failures: number,
  random: () => number = Math.random,
): number => {
  const jitter = (random() * 2 - 1) * JITTER_MS;
  const backoff =
    failures > 0 ? Math.min(BACKOFF_CAP_MS, baseMs * 2 ** failures) : baseMs;
  return Math.max(100, Math.round(backoff + jitter));
};
