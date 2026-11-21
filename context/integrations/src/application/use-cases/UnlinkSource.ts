import { IntegrationError } from '../errors.ts';
import type { SnapshotCache, SourceLinkRepository } from '../ports/index.ts';

export class UnlinkSource {
  private readonly sources: SourceLinkRepository;
  private readonly snapshots: SnapshotCache;

  constructor(sources: SourceLinkRepository, snapshots: SnapshotCache) {
    this.sources = sources;
    this.snapshots = snapshots;
  }

  async execute(id: string): Promise<void> {
    this.snapshots.delete(id);
    if (!(await this.sources.remove(id))) {
      throw new IntegrationError(
        'source_not_found',
        'Esa planilla ya no está vinculada',
      );
    }
  }
}
