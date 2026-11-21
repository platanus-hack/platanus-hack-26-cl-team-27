import type { Claim, ClaimDraft } from '../../domain/Claim.ts';

export interface ClaimRepository {
  saveMany(revisionId: string, drafts: readonly ClaimDraft[]): Promise<Claim[]>;
  list(): Promise<Claim[]>;
  listFor(subject: string, attribute: string): Promise<Claim[]>;
  clear(): Promise<void>;
}
