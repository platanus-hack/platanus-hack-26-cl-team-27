'use client';

import { useEffect, useRef, useState } from 'react';

import { getEvents, type RoomEvent } from '@/lib/events-api';
import { isAbort } from '@/lib/http';
import {
  applyPulse,
  INITIAL_PULSE,
  nextDelay,
  type PulseState,
} from '@/lib/pulse';

export type PulseStatus = 'connecting' | 'live' | 'offline';

export interface RoomPulseOptions {
  readonly intervalMs: number;
  readonly castId?: string | null;
  readonly seatToken?: string | null;
  readonly enabled?: boolean;
  readonly onEvents?: (events: readonly RoomEvent[]) => void;
  readonly onReset?: () => void;
}

export interface RoomPulse {
  readonly events: readonly RoomEvent[];
  readonly status: PulseStatus;
}

export const useRoomPulse = ({
  intervalMs,
  castId = null,
  seatToken = null,
  enabled = true,
  onEvents,
  onReset,
}: RoomPulseOptions): RoomPulse => {
  const [events, setEvents] = useState<readonly RoomEvent[]>([]);
  const [status, setStatus] = useState<PulseStatus>('connecting');
  const handlers = useRef({ onEvents, onReset });

  useEffect(() => {
    handlers.current = { onEvents, onReset };
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let state: PulseState = INITIAL_PULSE;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let stopped = false;

    const schedule = () => {
      if (stopped || document.hidden) return;
      timer = setTimeout(tick, nextDelay(intervalMs, failures));
    };

    const tick = async () => {
      timer = null;
      controller = new AbortController();
      try {
        const response = await getEvents(
          {
            after: state.cursor,
            epoch: state.epoch,
            castId,
            seatToken,
          },
          controller.signal,
        );
        const step = applyPulse(state, response);
        state = step.state;
        failures = 0;
        setStatus('live');
        if (step.reset) {
          setEvents([]);
          handlers.current.onReset?.();
        } else if (step.fresh.length > 0) {
          setEvents(state.events);
          handlers.current.onEvents?.(step.fresh);
        } else if (state.events.length > 0) {
          setEvents((current) =>
            current.length === 0 ? state.events : current,
          );
        }
      } catch (error) {
        if (isAbort(error)) return;
        failures += 1;
        setStatus('offline');
      }
      schedule();
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (timer) clearTimeout(timer);
        timer = null;
        controller?.abort();
        return;
      }
      if (timer) clearTimeout(timer);
      void tick();
    };

    document.addEventListener('visibilitychange', onVisibility);
    if (!document.hidden) void tick();

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [intervalMs, castId, seatToken, enabled]);

  return { events, status };
};
