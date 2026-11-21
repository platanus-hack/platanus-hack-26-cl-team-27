import type { SnapshotCache } from '../../application/ports/index.ts';
import type { SheetSnapshot } from '../../domain/Sheet.ts';

export class InMemorySnapshotCache implements SnapshotCache {
  private readonly snapshots = new Map<string, SheetSnapshot>();

  get(sourceId: string): SheetSnapshot | null {
    return this.snapshots.get(sourceId) ?? null;
  }

  set(sourceId: string, snapshot: SheetSnapshot): void {
    this.snapshots.set(sourceId, snapshot);
  }

  delete(sourceId: string): void {
    this.snapshots.delete(sourceId);
  }
}
