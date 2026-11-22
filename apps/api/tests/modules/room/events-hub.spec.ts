import {
  EventsHub,
  type EventsStore,
  type HubEvent,
} from '../../../src/modules/room/events-hub.ts';
import { ChangeSignal } from '../../../src/modules/database/change-signal.ts';

const PROJECT = 'los-aromos';

const row = (seq: number, epoch = 1): HubEvent & { epoch: number } => ({
  seq,
  epoch,
  kind: 'proposal.opened',
  message: `evento ${seq}`,
  refs: {},
  at: new Date(0),
});

class FakeStore implements EventsStore {
  epoch = 1;
  rows: (HubEvent & { epoch: number })[] = [];
  probes = 0;
  fetches = 0;

  add(seq: number): void {
    this.rows.push(row(seq, this.epoch));
  }

  probe() {
    this.probes += 1;
    return Promise.resolve({
      epoch: this.epoch,
      maxSeq: this.rows.reduce((max, r) => Math.max(max, r.seq), 0),
    });
  }

  fetch(_project: string, epoch: number, after: number, take: number) {
    this.fetches += 1;
    return Promise.resolve(
      this.rows
        .filter((r) => r.epoch === epoch && r.seq > after)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, take),
    );
  }
}

const request = (after: number, extra: Record<string, unknown> = {}) => ({
  projectId: PROJECT,
  epoch: 1,
  after,
  limit: 100,
  waitMs: 10_000,
  ...extra,
});

describe('EventsHub', () => {
  let store: FakeStore;
  let signal: ChangeSignal;
  let hub: EventsHub;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new FakeStore();
    signal = new ChangeSignal();
    hub = new EventsHub(store, signal);
  });

  afterEach(() => {
    hub.close();
    vi.useRealTimers();
  });

  it('trae los eventos una sola vez cuando despiertan muchas esperas', async () => {
    const waits = Array.from({ length: 50 }, () => hub.wait(request(0)));
    await vi.advanceTimersByTimeAsync(300);
    store.add(1);
    store.add(2);
    store.fetches = 0;
    await vi.advanceTimersByTimeAsync(300);
    const outcomes = await Promise.all(waits);
    expect(store.fetches).toBe(1);
    for (const outcome of outcomes) {
      expect(outcome.kind).toBe('events');
      if (outcome.kind === 'events') {
        expect(outcome.events.map((event) => event.seq)).toEqual([1, 2]);
      }
    }
    expect(hub.waiting()).toBe(0);
    expect(hub.watching()).toBe(0);
  });

  it('cada espera recibe solo su tramo', async () => {
    store.add(1);
    store.add(2);
    store.add(3);
    const early = hub.wait(request(0));
    const late = hub.wait(request(2));
    await vi.advanceTimersByTimeAsync(300);
    const [a, b] = await Promise.all([early, late]);
    expect(a.kind === 'events' && a.events.map((e) => e.seq)).toEqual([
      1, 2, 3,
    ]);
    expect(b.kind === 'events' && b.events.map((e) => e.seq)).toEqual([3]);
    expect(store.fetches).toBe(1);
  });

  it('con el tope cortado sigue trayendo hasta atender a las esperas con cursor más alto', async () => {
    for (let seq = 1; seq <= 5; seq += 1) store.add(seq);
    const slow = hub.wait(request(0, { limit: 2 }));
    const ahead = hub.wait(request(4, { limit: 2 }));
    await vi.advanceTimersByTimeAsync(300);
    const [a, b] = await Promise.all([slow, ahead]);
    expect(a.kind === 'events' && a.events.map((e) => e.seq)).toEqual([1, 2]);
    expect(b.kind === 'events' && b.events.map((e) => e.seq)).toEqual([5]);
  });

  it('vence la espera sin eventos y deja de vigilar', async () => {
    const waiting = hub.wait(request(0, { waitMs: 2_000 }));
    await vi.advanceTimersByTimeAsync(2_001);
    await expect(waiting).resolves.toEqual({ kind: 'timeout' });
    expect(hub.waiting()).toBe(0);
    expect(hub.watching()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('al desconectarse saca la espera y libera los timers', async () => {
    const gone = new AbortController();
    const waiting = hub.wait(request(0, { signal: gone.signal }));
    expect(hub.waiting()).toBe(1);
    gone.abort();
    await expect(waiting).resolves.toEqual({ kind: 'aborted' });
    expect(hub.waiting()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('una señal ya abortada responde de inmediato sin registrar nada', async () => {
    const gone = new AbortController();
    gone.abort();
    await expect(
      hub.wait(request(0, { signal: gone.signal })),
    ).resolves.toEqual({ kind: 'aborted' });
    expect(hub.watching()).toBe(0);
  });

  it('un cambio de época responde reset con la época y el cursor nuevos', async () => {
    store.add(1);
    const waiting = hub.wait(request(1));
    await vi.advanceTimersByTimeAsync(300);
    store.epoch = 2;
    store.add(2);
    await vi.advanceTimersByTimeAsync(300);
    await expect(waiting).resolves.toEqual({
      kind: 'reset',
      epoch: 2,
      cursor: 2,
    });
  });

  it('un cursor adelantado a la sala responde reset', async () => {
    store.add(1);
    const waiting = hub.wait(request(9));
    await vi.advanceTimersByTimeAsync(300);
    await expect(waiting).resolves.toEqual({
      kind: 'reset',
      epoch: 1,
      cursor: 1,
    });
  });

  it('el aviso de un cambio despierta antes del tick', async () => {
    const waiting = hub.wait(request(0));
    await vi.advanceTimersByTimeAsync(10);
    store.add(1);
    signal.notify();
    await vi.advanceTimersByTimeAsync(5);
    const outcome = await waiting;
    expect(outcome.kind).toBe('events');
  });

  it('sin esperas el aviso no consulta nada', async () => {
    signal.notify();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(store.probes).toBe(0);
  });

  it('cada tick hace una sola consulta barata aunque haya muchas esperas', async () => {
    const waits = Array.from({ length: 100 }, () =>
      hub.wait(request(0, { waitMs: 2_000 })),
    );
    await vi.advanceTimersByTimeAsync(10);
    store.probes = 0;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(store.probes).toBeLessThanOrEqual(5);
    expect(store.fetches).toBe(0);
    await vi.advanceTimersByTimeAsync(1_100);
    await Promise.all(waits);
  });

  it('pasado el tope de esperas simultáneas responde full', async () => {
    const small = new EventsHub(store, signal, { maxWaiters: 2 });
    const a = small.wait(request(0));
    const b = small.wait(request(0));
    await expect(small.wait(request(0))).resolves.toEqual({ kind: 'full' });
    small.close();
    await Promise.all([a, b]);
  });

  it('un error de la consulta no pierde las esperas: el siguiente tick reintenta', async () => {
    let fail = true;
    const original = store.probe.bind(store);
    store.probe = () => (fail ? Promise.reject(new Error('db')) : original());
    const waiting = hub.wait(request(0));
    await vi.advanceTimersByTimeAsync(300);
    fail = false;
    store.add(1);
    await vi.advanceTimersByTimeAsync(300);
    expect((await waiting).kind).toBe('events');
  });
});
