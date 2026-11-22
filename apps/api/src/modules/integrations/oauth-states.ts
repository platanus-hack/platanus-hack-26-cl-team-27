import { randomUUID } from 'node:crypto';

export const STATE_TTL_MS = 10 * 60_000;

export interface StateOwner {
  readonly userId: string;
  readonly projectId: string | null;
}

interface IssuedState {
  readonly owner: StateOwner;
  readonly expiresAt: number;
}

export class OAuthStates {
  private readonly states = new Map<string, IssuedState>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  issue(owner: StateOwner): string {
    this.purge();
    const state = randomUUID();
    this.states.set(state, { owner, expiresAt: this.now() + STATE_TTL_MS });
    return state;
  }

  consume(state: string | undefined): StateOwner | null {
    this.purge();
    const issued = state ? this.states.get(state) : undefined;
    if (!state || !issued) return null;
    this.states.delete(state);
    return issued.owner;
  }

  private purge(): void {
    const now = this.now();
    for (const [state, issued] of this.states) {
      if (issued.expiresAt <= now) this.states.delete(state);
    }
  }
}
