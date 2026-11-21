import type { FactExtractor } from '../../application/ports/FactExtractor.ts';
import type { ClaimDraft } from '../../domain/Claim.ts';
import type { RevisionDraft } from '../../domain/Revision.ts';

export type FixtureCatalog = Readonly<Record<string, readonly ClaimDraft[]>>;

export const fixtureKey = (documentId: string, label: string): string =>
  `${documentId}@${label}`;

export class FixtureFactExtractor implements FactExtractor {
  private readonly catalog: FixtureCatalog;

  constructor(catalog: FixtureCatalog) {
    this.catalog = catalog;
  }

  async extract(revision: RevisionDraft): Promise<ClaimDraft[]> {
    const claims =
      this.catalog[fixtureKey(revision.documentId, revision.label)];
    return Promise.resolve(claims ? [...claims] : []);
  }
}
