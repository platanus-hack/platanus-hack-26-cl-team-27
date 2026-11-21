import { randomUUID } from 'node:crypto';

export const STATE_TTL_MS = 10 * 60_000;

export class OAuthStates {
  private readonly states = new Map<string, number>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  issue(): string {
    this.purge();
    const state = randomUUID();
    this.states.set(state, this.now() + STATE_TTL_MS);
    return state;
  }

  consume(state: string | undefined): boolean {
    this.purge();
    if (!state || !this.states.has(state)) return false;
    this.states.delete(state);
    return true;
  }

  private purge(): void {
    const now = this.now();
    for (const [state, expiresAt] of this.states) {
      if (expiresAt <= now) this.states.delete(state);
    }
  }
}
