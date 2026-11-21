import type { Stakeholder } from '../../domain/Stakeholder.ts';
import type { StakeholderDirectory } from '../ports/StakeholderDirectory.ts';

export class ListStakeholders {
  private readonly directory: StakeholderDirectory;

  constructor(directory: StakeholderDirectory) {
    this.directory = directory;
  }

  execute(): Promise<Stakeholder[]> {
    return this.directory.list();
  }
}
