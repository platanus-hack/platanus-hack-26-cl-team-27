import type { StakeholderDirectory } from '../../application/ports/StakeholderDirectory.ts';
import type { Stakeholder } from '../../domain/Stakeholder.ts';

export class InMemoryStakeholderDirectory implements StakeholderDirectory {
  private readonly stakeholders: readonly Stakeholder[];

  constructor(stakeholders: readonly Stakeholder[]) {
    this.stakeholders = stakeholders;
  }

  list(): Promise<Stakeholder[]> {
    return Promise.resolve([...this.stakeholders]);
  }
}
