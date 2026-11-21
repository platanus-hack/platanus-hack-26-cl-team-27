import type { FactExtractor } from '../../application/ports/FactExtractor.ts';
import type { ClaimDraft } from '../../domain/Claim.ts';

export class InlineFactExtractor implements FactExtractor {
  private readonly claims: readonly ClaimDraft[];

  constructor(claims: readonly ClaimDraft[]) {
    this.claims = claims;
  }

  extract(): Promise<ClaimDraft[]> {
    return Promise.resolve([...this.claims]);
  }
}
