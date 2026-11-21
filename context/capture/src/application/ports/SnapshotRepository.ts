import type { Snapshot } from '../../domain/ModelElement.ts';

export interface SnapshotRepository {
  latest(integrationId: string): Promise<Snapshot | null>;
  save(snapshot: Snapshot): Promise<void>;
}
