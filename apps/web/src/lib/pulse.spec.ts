import { describe, expect, it } from 'vitest';

import { eventsPath } from './events-api';
import {
  applyPulse,
  BACKOFF_CAP_MS,
  INITIAL_PULSE,
  nextDelay,
  type PulseState,
} from './pulse';

const event = (seq: number) => ({
  seq,
  kind: 'vote',
  message: `evento ${seq}`,
  at: '2026-01-01T00:00:00Z',
});

describe('eventsPath', () => {
  it('arma el sondeo con cursor, época y asiento', () => {
    expect(eventsPath({ after: null, epoch: null })).toBe('/api/events');
    expect(eventsPath({ after: 4, epoch: 2, castId: 'paula-rojas' })).toBe(
      '/api/events?after=4&epoch=2&seat=paula-rojas',
    );
  });
});

describe('applyPulse', () => {
  it('la primera respuesta fija época y cursor sin recargar ni anunciar', () => {
    const step = applyPulse(INITIAL_PULSE, {
      epoch: 3,
      cursor: 7,
      reset: false,
      events: [event(6), event(7)],
    });
    expect(step.reset).toBe(false);
    expect(step.fresh).toEqual([]);
    expect(step.state.cursor).toBe(7);
    expect(step.state.events.map((e) => e.seq)).toEqual([7, 6]);
  });

  it('suma eventos nuevos, sin duplicar, y avanza el cursor', () => {
    const state: PulseState = { epoch: 1, cursor: 2, events: [event(2)] };
    const step = applyPulse(state, {
      epoch: 1,
      cursor: 4,
      reset: false,
      events: [event(2), event(3), event(4)],
    });
    expect(step.fresh.map((e) => e.seq)).toEqual([3, 4]);
    expect(step.state.cursor).toBe(4);
    expect(step.state.events.map((e) => e.seq)).toEqual([4, 3, 2]);
  });

  it('sin eventos no mueve el cursor hacia atrás', () => {
    const state: PulseState = { epoch: 1, cursor: 9, events: [] };
    const step = applyPulse(state, {
      epoch: 1,
      cursor: 5,
      reset: false,
      events: [],
    });
    expect(step.state.cursor).toBe(9);
    expect(step.fresh).toEqual([]);
  });

  it('reset:true limpia el ticker y pide recargar', () => {
    const state: PulseState = { epoch: 1, cursor: 9, events: [event(9)] };
    const step = applyPulse(state, {
      epoch: 2,
      cursor: 0,
      reset: true,
      events: [],
    });
    expect(step.reset).toBe(true);
    expect(step.state).toEqual({ epoch: 2, cursor: 0, events: [] });
  });

  it('un cambio de época también es un reinicio', () => {
    const state: PulseState = { epoch: 1, cursor: 3, events: [] };
    const step = applyPulse(state, {
      epoch: 2,
      cursor: 1,
      reset: false,
      events: [event(1)],
    });
    expect(step.reset).toBe(true);
  });

  it('limita el ticker', () => {
    const events = Array.from({ length: 10 }, (_, i) => event(i + 1));
    const step = applyPulse(
      { epoch: 1, cursor: 0, events: [] },
      { epoch: 1, cursor: 10, reset: false, events },
      3,
    );
    expect(step.state.events.map((e) => e.seq)).toEqual([10, 9, 8]);
  });
});

describe('nextDelay', () => {
  it('suma jitter de hasta 150 ms', () => {
    expect(nextDelay(1000, 0, () => 0)).toBe(850);
    expect(nextDelay(1000, 0, () => 0.5)).toBe(1000);
    expect(nextDelay(1000, 0, () => 1)).toBe(1150);
  });

  it('con errores retrocede hasta 3 s', () => {
    expect(nextDelay(700, 1, () => 0.5)).toBe(1400);
    expect(nextDelay(700, 2, () => 0.5)).toBe(2800);
    expect(nextDelay(700, 5, () => 0.5)).toBe(BACKOFF_CAP_MS);
  });
});
