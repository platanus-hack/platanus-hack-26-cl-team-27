import type { Change } from '../../domain/Change.ts';
import { diffSnapshots } from '../../domain/diffSnapshots.ts';
import type { ModelElement } from '../../domain/ModelElement.ts';
import { ValidationError } from '../errors.ts';
import type { ChangeRepository } from '../ports/ChangeRepository.ts';
import type { SnapshotRepository } from '../ports/SnapshotRepository.ts';

export interface PublishVersionInput {
  readonly integrationId: string;
  readonly elements: readonly ModelElement[];
}

export interface PublishedVersion {
  readonly version: number;
  readonly changes: readonly Change[];
}

export class PublishVersion {
  private readonly snapshots: SnapshotRepository;
  private readonly changes: ChangeRepository;

  constructor(snapshots: SnapshotRepository, changes: ChangeRepository) {
    this.snapshots = snapshots;
    this.changes = changes;
  }

  async execute(input: PublishVersionInput): Promise<PublishedVersion> {
    const ids = input.elements.map((element) => element.id);
    if (new Set(ids).size !== ids.length) {
      throw new ValidationError(
        'Cada elemento del modelo debe tener un id único',
      );
    }

    const previous = await this.snapshots.latest(input.integrationId);
    const version = (previous?.version ?? 0) + 1;
    const drafts = previous
      ? diffSnapshots(
          previous.elements,
          input.elements,
          input.integrationId,
          version,
        )
      : [];

    if (previous && drafts.length === 0) {
      return { version: previous.version, changes: [] };
    }

    await this.snapshots.save({
      integrationId: input.integrationId,
      version,
      publishedAt: new Date(),
      elements: input.elements,
    });
    const changes =
      drafts.length > 0 ? await this.changes.saveMany(drafts) : [];
    return { version, changes };
  }
}
