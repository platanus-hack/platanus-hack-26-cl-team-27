import type { Stakeholder } from '../../domain/Stakeholder.ts';

export interface StakeholderDirectory {
  list(): Promise<Stakeholder[]>;
}
