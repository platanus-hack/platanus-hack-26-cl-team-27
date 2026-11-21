import { IntegrationError } from '../errors.ts';
import type { SourceLinkRepository } from '../ports/index.ts';

export class UnlinkSource {
  private readonly sources: SourceLinkRepository;

  constructor(sources: SourceLinkRepository) {
    this.sources = sources;
  }

  async execute(id: string): Promise<void> {
    if (!(await this.sources.remove(id))) {
      throw new IntegrationError(
        'source_not_found',
        'Esa planilla ya no está vinculada',
      );
    }
  }
}
