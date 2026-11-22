import { request } from './http';
import { longPollTimeoutMs } from './pulse';

export interface RoomEvent {
  readonly seq: number;
  readonly kind: string;
  readonly message: string;
  readonly at: string;
}

export interface EventsResponse {
  readonly epoch: number;
  readonly cursor: number;
  readonly reset: boolean;
  readonly events: readonly RoomEvent[];
  readonly longPoll?: boolean;
}

export interface EventsQuery {
  readonly after: number | null;
  readonly epoch: number | null;
  readonly castId?: string | null;
  readonly seatToken?: string | null;
  readonly waitSeconds?: number;
}

export const eventsPath = ({
  after,
  epoch,
  castId,
  waitSeconds,
}: Pick<EventsQuery, 'after' | 'epoch' | 'castId' | 'waitSeconds'>): string => {
  const params = new URLSearchParams();
  if (after !== null) params.set('after', String(after));
  if (epoch !== null) params.set('epoch', String(epoch));
  if (castId) params.set('seat', castId);
  if (waitSeconds) params.set('wait', String(waitSeconds));
  const query = params.toString();
  return `/api/events${query ? `?${query}` : ''}`;
};

export const getEvents = (
  query: EventsQuery,
  signal?: AbortSignal,
): Promise<EventsResponse> =>
  request<EventsResponse>(eventsPath(query), {
    seatToken: query.seatToken,
    signal,
    ...(query.waitSeconds
      ? { timeoutMs: longPollTimeoutMs(query.waitSeconds) }
      : {}),
  });
