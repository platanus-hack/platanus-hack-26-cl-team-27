export const percentile = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))] ?? 0;
};

export interface Summary {
  readonly count: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
}

export const summarize = (values: readonly number[]): Summary => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? 0,
  };
};

export interface EndpointStats extends Summary {
  readonly endpoint: string;
  readonly errors: Readonly<Record<string, number>>;
}

export class Metrics {
  private readonly byEndpoint = new Map<
    string,
    { ms: number[]; errors: Map<string, number> }
  >();

  record(endpoint: string, ms: number, error: string | null): void {
    let entry = this.byEndpoint.get(endpoint);
    if (entry === undefined) {
      entry = { ms: [], errors: new Map() };
      this.byEndpoint.set(endpoint, entry);
    }
    entry.ms.push(ms);
    if (error !== null) {
      entry.errors.set(error, (entry.errors.get(error) ?? 0) + 1);
    }
  }

  endpoints(): EndpointStats[] {
    return [...this.byEndpoint.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([endpoint, { ms, errors }]) => ({
        endpoint,
        errors: Object.fromEntries(errors),
        ...summarize(ms),
      }));
  }
}

export interface ActionStats {
  readonly action: string;
  readonly expected: number;
  readonly seen: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
  readonly underLimit: number;
}

export const VISIBLE_LIMIT_MS = 2000;

interface OpenAction {
  readonly name: string;
  readonly target: string;
  readonly t0: number;
  readonly seen: Map<number, number>;
}

export class Tracker {
  private current: OpenAction | null = null;
  private readonly results = new Map<
    string,
    { latencies: number[]; expected: number }
  >();
  private readonly now: () => number;

  constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }

  open(name: string, target: string): void {
    this.current = { name, target, t0: this.now(), seen: new Map() };
  }

  observe(spectator: number, phase: string): void {
    const action = this.current;
    if (action === null || phase !== action.target) return;
    if (!action.seen.has(spectator)) {
      action.seen.set(spectator, Math.max(0, this.now() - action.t0));
    }
  }

  seenCount(): number {
    return this.current?.seen.size ?? 0;
  }

  close(expected: number): void {
    const action = this.current;
    if (action === null) return;
    this.current = null;
    const entry = this.results.get(action.name) ?? {
      latencies: [],
      expected: 0,
    };
    entry.latencies.push(...action.seen.values());
    entry.expected += expected;
    this.results.set(action.name, entry);
  }

  actions(): ActionStats[] {
    return [...this.results.entries()].map(([action, entry]) => {
      const summary = summarize(entry.latencies);
      return {
        action,
        expected: entry.expected,
        seen: summary.count,
        p50: summary.p50,
        p95: summary.p95,
        max: summary.max,
        underLimit: entry.latencies.filter((ms) => ms < VISIBLE_LIMIT_MS)
          .length,
      };
    });
  }
}
