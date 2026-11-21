import type { Change, ChangeDraft } from '../../domain/Change.ts';

export interface ChangeRepository {
  saveMany(drafts: readonly ChangeDraft[]): Promise<Change[]>;
  listRecent(limit: number): Promise<Change[]>;
  findById(id: string): Promise<Change | null>;
}
