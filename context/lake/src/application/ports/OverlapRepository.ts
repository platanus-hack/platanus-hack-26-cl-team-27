import type { Overlap, OverlapDraft } from '../../domain/Overlap.ts';

export interface OverlapRepository {
  create(draft: OverlapDraft): Promise<Overlap>;
  save(overlap: Overlap): Promise<void>;
  findById(id: string): Promise<Overlap | null>;
  list(): Promise<Overlap[]>;
  listLive(): Promise<Overlap[]>;
  clear(): Promise<void>;
}
