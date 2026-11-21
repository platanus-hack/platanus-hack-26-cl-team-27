import type { Snapshot } from '../../domain/ModelElement.ts';
import type { SnapshotRepository } from '../ports/SnapshotRepository.ts';

export class GetLatestSnapshot {
  private readonly snapshots: SnapshotRepository;

  constructor(snapshots: SnapshotRepository) {
    this.snapshots = snapshots;
  }

  execute(integrationId: string): Promise<Snapshot | null> {
    return this.snapshots.latest(integrationId);
  }
}
