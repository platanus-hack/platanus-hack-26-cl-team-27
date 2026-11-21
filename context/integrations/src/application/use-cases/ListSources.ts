import type { SourceLink } from '../../domain/Connection.ts';
import type { SourceLinkRepository } from '../ports/index.ts';

export class ListSources {
  private readonly sources: SourceLinkRepository;

  constructor(sources: SourceLinkRepository) {
    this.sources = sources;
  }

  execute(): Promise<SourceLink[]> {
    return this.sources.list();
  }
}
