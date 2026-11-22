import type { SnapshotCache, SourceLinkRepository } from '../ports/index.ts';
import { sourceNotFound } from './requireGoogle.ts';

export class UnlinkSource {
  private readonly sources: SourceLinkRepository;
  private readonly snapshots: SnapshotCache;

  constructor(sources: SourceLinkRepository, snapshots: SnapshotCache) {
    this.sources = sources;
    this.snapshots = snapshots;
  }

  async execute(projectId: string, id: string): Promise<void> {
    const source = await this.sources.find(id);
    if (source === null || source.projectId !== projectId) {
      throw sourceNotFound();
    }
    this.snapshots.delete(id);
    if (!(await this.sources.remove(id))) throw sourceNotFound();
  }
}
