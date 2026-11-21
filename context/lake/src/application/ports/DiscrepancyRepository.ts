import type {
  Discrepancy,
  DiscrepancyDraft,
  DiscrepancyResolution,
} from '../../domain/Discrepancy.ts';

export interface DiscrepancyRepository {
  create(draft: DiscrepancyDraft): Promise<Discrepancy>;
  resolve(id: string, resolution: DiscrepancyResolution): Promise<Discrepancy>;
  findById(id: string): Promise<Discrepancy | null>;
  list(): Promise<Discrepancy[]>;
  listOpen(): Promise<Discrepancy[]>;
  clear(): Promise<void>;
}
