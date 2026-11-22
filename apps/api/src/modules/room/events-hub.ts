export const TICK_MS = 250;
export const MAX_WAITERS = 1000;

export interface HubEvent {
  readonly seq: number;
  readonly kind: string;
  readonly message: string;
  readonly refs: unknown;
  readonly at: Date;
}

export interface EventsProbe {
  readonly epoch: number;
  readonly maxSeq: number;
}

export interface EventsStore {
  probe(projectId: string): Promise<EventsProbe>;
  fetch(
    projectId: string,
    epoch: number,
    after: number,
    take: number,
  ): Promise<readonly HubEvent[]>;
}

export interface ChangeSource {
  subscribe(listener: () => void): () => void;
}

export interface WaitRequest {
  readonly projectId: string;
  readonly epoch: number;
  readonly after: number;
  readonly limit: number;
  readonly waitMs: number;
  readonly signal?: AbortSignal;
}

export type WaitOutcome =
  | { readonly kind: 'events'; readonly events: readonly HubEvent[] }
  | { readonly kind: 'reset'; readonly epoch: number; readonly cursor: number }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'full' };

export interface HubOptions {
  readonly tickMs?: number;
  readonly maxWaiters?: number;
}

interface Waiter {
  readonly request: WaitRequest;
  readonly resolve: (outcome: WaitOutcome) => void;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly onAbort: () => void;
  settled: boolean;
}

interface Watch {
  readonly waiters: Set<Waiter>;
  readonly interval: ReturnType<typeof setInterval>;
  probing: boolean;
  again: boolean;
  last: { readonly probe: EventsProbe; readonly at: number } | null;
}

export class EventsHub {
  private readonly store: EventsStore;
  private readonly tickMs: number;
  private readonly maxWaiters: number;
  private readonly watches = new Map<string, Watch>();
  private readonly unsubscribe: () => void;
  private total = 0;

  constructor(
    store: EventsStore,
    changes: ChangeSource,
    options: HubOptions = {},
  ) {
    this.store = store;
    this.tickMs = options.tickMs ?? TICK_MS;
    this.maxWaiters = options.maxWaiters ?? MAX_WAITERS;
    this.unsubscribe = changes.subscribe(() => this.nudge());
  }

  onModuleDestroy(): void {
    this.close();
  }

  waiting(): number {
    return this.total;
  }

  watching(): number {
    return this.watches.size;
  }

  wait(request: WaitRequest): Promise<WaitOutcome> {
    if (request.signal?.aborted) return Promise.resolve({ kind: 'aborted' });
    if (this.total >= this.maxWaiters) return Promise.resolve({ kind: 'full' });
    return new Promise<WaitOutcome>((resolve) => {
      const watch = this.watchFor(request.projectId);
      const waiter: Waiter = {
        request,
        resolve,
        settled: false,
        timer: setTimeout(
          () => this.settle(waiter, { kind: 'timeout' }),
          request.waitMs,
        ),
        onAbort: () => this.settle(waiter, { kind: 'aborted' }),
      };
      request.signal?.addEventListener('abort', waiter.onAbort, {
        once: true,
      });
      watch.waiters.add(waiter);
      this.total += 1;
      if (!this.isCovered(watch, request)) void this.probe(request.projectId);
    });
  }

  nudge(): void {
    for (const projectId of [...this.watches.keys()])
      void this.probe(projectId);
  }

  close(): void {
    this.unsubscribe();
    for (const watch of [...this.watches.values()]) {
      for (const waiter of [...watch.waiters]) {
        this.settle(waiter, { kind: 'aborted' });
      }
    }
  }

  private isCovered(watch: Watch, request: WaitRequest): boolean {
    const last = watch.last;
    return (
      last !== null &&
      Date.now() - last.at < this.tickMs &&
      last.probe.epoch === request.epoch &&
      request.after >= last.probe.maxSeq
    );
  }

  private watchFor(projectId: string): Watch {
    const found = this.watches.get(projectId);
    if (found) return found;
    const watch: Watch = {
      waiters: new Set(),
      interval: setInterval(() => void this.probe(projectId), this.tickMs),
      probing: false,
      again: false,
      last: null,
    };
    this.watches.set(projectId, watch);
    return watch;
  }

  private settle(waiter: Waiter, outcome: WaitOutcome): void {
    if (waiter.settled) return;
    waiter.settled = true;
    clearTimeout(waiter.timer);
    waiter.request.signal?.removeEventListener('abort', waiter.onAbort);
    const watch = this.watches.get(waiter.request.projectId);
    if (watch?.waiters.delete(waiter)) {
      this.total -= 1;
      if (watch.waiters.size === 0) {
        clearInterval(watch.interval);
        this.watches.delete(waiter.request.projectId);
      }
    }
    waiter.resolve(outcome);
  }

  private async probe(projectId: string): Promise<void> {
    const watch = this.watches.get(projectId);
    if (!watch) return;
    if (watch.probing) {
      watch.again = true;
      return;
    }
    watch.probing = true;
    try {
      do {
        watch.again = false;
        await this.cycle(watch, projectId);
      } while (watch.again && watch.waiters.size > 0);
    } catch {
      watch.last = null;
    } finally {
      watch.probing = false;
    }
  }

  private async cycle(watch: Watch, projectId: string): Promise<void> {
    const probe = await this.store.probe(projectId);
    watch.last = { probe, at: Date.now() };
    let pending: Waiter[] = [];
    for (const waiter of [...watch.waiters]) {
      const { epoch, after } = waiter.request;
      if (epoch !== probe.epoch || after > probe.maxSeq) {
        this.settle(waiter, {
          kind: 'reset',
          epoch: probe.epoch,
          cursor: probe.maxSeq,
        });
      } else if (after < probe.maxSeq) {
        pending.push(waiter);
      }
    }
    while (pending.length > 0) {
      const minAfter = Math.min(...pending.map((w) => w.request.after));
      const take = Math.max(...pending.map((w) => w.request.limit));
      const rows = await this.store.fetch(
        projectId,
        probe.epoch,
        minAfter,
        take,
      );
      for (const waiter of pending) {
        const { after, limit } = waiter.request;
        const events = rows.filter((row) => row.seq > after).slice(0, limit);
        if (events.length > 0) this.settle(waiter, { kind: 'events', events });
      }
      pending = pending.filter((waiter) => !waiter.settled);
      if (rows.length < take) break;
    }
  }
}
