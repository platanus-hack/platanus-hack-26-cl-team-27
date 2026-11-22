import type { AutodeskEventRepository } from '../../application/ports/index.ts';
import type { AutodeskChange } from '../../domain/autodesk/AutodeskChange.ts';

export interface RecordedAutodeskEvent {
  readonly change: AutodeskChange;
  readonly receivedAt: Date;
}

export class InMemoryAutodeskEventRepository implements AutodeskEventRepository {
  private readonly events = new Map<string, RecordedAutodeskEvent>();

  recordIfNew(change: AutodeskChange, receivedAt: Date): Promise<boolean> {
    if (this.events.has(change.dedupeKey)) return Promise.resolve(false);
    this.events.set(change.dedupeKey, { change, receivedAt });
    return Promise.resolve(true);
  }

  list(): RecordedAutodeskEvent[] {
    return [...this.events.values()];
  }
}
