import type { Change } from '../../domain/Change.ts';
import type { ChangeRepository } from '../ports/ChangeRepository.ts';

export class GetChange {
  private readonly changes: ChangeRepository;

  constructor(changes: ChangeRepository) {
    this.changes = changes;
  }

  execute(id: string): Promise<Change | null> {
    return this.changes.findById(id);
  }
}
