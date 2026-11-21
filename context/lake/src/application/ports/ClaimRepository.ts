import type { Claim, ClaimDraft } from '../../domain/Claim.ts';

export interface ClaimInsert extends ClaimDraft {
  readonly chunkId: string | null;
}

export interface ClaimRepository {
  saveMany(
    revisionId: string,
    inserts: readonly ClaimInsert[],
  ): Promise<Claim[]>;
  list(): Promise<Claim[]>;
  listFor(subject: string, attribute: string): Promise<Claim[]>;
  clear(): Promise<void>;
}
