export interface Resolved<V> {
  readonly key: string;
  readonly value: V;
}

export class KeyedMemo<V> {
  private readonly capacity: number;
  private readonly cache = new Map<string, V>();
  private readonly inflight = new Map<string, Promise<Resolved<V>>>();

  constructor(capacity = 8) {
    this.capacity = capacity;
  }

  async get(key: string, compute: () => Promise<Resolved<V>>): Promise<V> {
    if (this.cache.has(key)) return this.cache.get(key) as V;
    const running = this.inflight.get(key);
    if (running) return (await running).value;
    const task = compute().then((resolved) => {
      this.store(resolved);
      return resolved;
    });
    this.inflight.set(key, task);
    try {
      return (await task).value;
    } finally {
      if (this.inflight.get(key) === task) this.inflight.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private store(resolved: Resolved<V>): void {
    this.cache.delete(resolved.key);
    this.cache.set(resolved.key, resolved.value);
    while (this.cache.size > this.capacity) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
  }
}
