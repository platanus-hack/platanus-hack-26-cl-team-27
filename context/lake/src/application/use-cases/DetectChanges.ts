import type { Change } from '../../domain/Change.ts';
import { diffSnapshots } from '../../domain/diffSnapshots.ts';
import type { ModelElement } from '../../domain/ModelElement.ts';
import { ValidationError } from '../errors.ts';
import type { ChangeRepository } from '../ports/ChangeRepository.ts';

export interface DetectChangesInput {
  readonly sourceId: string;
  readonly base: readonly ModelElement[];
  readonly next: readonly ModelElement[];
}

const assertUniqueIds = (elements: readonly ModelElement[]): void => {
  const ids = elements.map((element) => element.id);
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError(
      'Cada elemento del modelo debe tener un id único',
    );
  }
};

export class DetectChanges {
  private readonly changes: ChangeRepository;

  constructor(changes: ChangeRepository) {
    this.changes = changes;
  }

  async execute(input: DetectChangesInput): Promise<Change[]> {
    if (!input.sourceId) {
      throw new ValidationError('El cambio necesita la revisión de origen');
    }
    assertUniqueIds(input.base);
    assertUniqueIds(input.next);
    const drafts = diffSnapshots(input.base, input.next, input.sourceId);
    if (drafts.length === 0) return [];
    return this.changes.saveMany(drafts);
  }
}
