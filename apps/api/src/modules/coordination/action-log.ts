const CAPACITY = 500;

export class ActionLog {
  private readonly results = new Map<string, Promise<unknown>>();

  once<T>(
    actionId: string | undefined,
    scope: string,
    run: () => Promise<T>,
  ): Promise<T> {
    if (!actionId) return run();
    const key = `${scope}:${actionId}`;
    const known = this.results.get(key);
    if (known) return known as Promise<T>;
    const pending = run();
    this.results.set(key, pending);
    pending.catch(() => this.results.delete(key));
    if (this.results.size > CAPACITY) {
      const oldest = this.results.keys().next().value;
      if (oldest !== undefined) this.results.delete(oldest);
    }
    return pending;
  }

  clear(): void {
    this.results.clear();
  }
}
