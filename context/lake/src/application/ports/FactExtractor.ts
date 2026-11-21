import type { ClaimDraft } from '../../domain/Claim.ts';
import type { RevisionDraft } from '../../domain/Revision.ts';

export interface FactExtractor {
  extract(revision: RevisionDraft): Promise<ClaimDraft[]>;
}
