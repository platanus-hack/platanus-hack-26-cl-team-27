import type { Change } from '../../domain/Change.ts';
import { ValidationError } from '../errors.ts';
import type { ChangeRepository } from '../ports/ChangeRepository.ts';

export const MAX_CHANGES = 50;

export class ListChanges {
  private readonly changes: ChangeRepository;

  constructor(changes: ChangeRepository) {
    this.changes = changes;
  }

  execute(limit = 20): Promise<Change[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CHANGES) {
      throw new ValidationError(
        `limit debe ser un entero entre 1 y ${MAX_CHANGES}`,
      );
    }
    return this.changes.listRecent(limit);
  }
}
