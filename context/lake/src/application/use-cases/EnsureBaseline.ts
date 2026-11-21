import type { SeedLakeInput } from './SeedLake.ts';
import { persistChunks } from '../persistChunks.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { ChunkRepository } from '../ports/ChunkRepository.ts';
import type { ClaimRepository } from '../ports/ClaimRepository.ts';
import type { RevisionRepository } from '../ports/RevisionRepository.ts';

export class EnsureBaseline {
  private readonly revisions: RevisionRepository;
  private readonly chunks: ChunkRepository;
  private readonly claims: ClaimRepository;
  private readonly baseline: BaselineRepository;

  constructor(
    revisions: RevisionRepository,
    chunks: ChunkRepository,
    claims: ClaimRepository,
    baseline: BaselineRepository,
  ) {
    this.revisions = revisions;
    this.chunks = chunks;
    this.claims = claims;
    this.baseline = baseline;
  }

  async execute(input: SeedLakeInput): Promise<{ seeded: number }> {
    let seeded = 0;
    for (const seed of input.revisions) {
      const existing = await this.revisions.findByKey(
        seed.revision.documentId,
        seed.revision.label,
      );
      if (existing) {
        await this.restore(existing.id, existing.ingestedAt, seed);
        continue;
      }
      const revision = await this.revisions.save(seed.revision);
      const { claims } = await persistChunks(
        this.chunks,
        this.claims,
        revision.id,
        seed.chunks,
      );
      for (const claim of claims) {
        if (claim.role !== 'afirma') continue;
        if (await this.baseline.find(claim.subject, claim.attribute)) continue;
        await this.baseline.upsert({
          subject: claim.subject,
          attribute: claim.attribute,
          value: claim.value,
          unit: claim.unit,
          claimId: claim.id,
          revisionId: revision.id,
          proposalId: null,
          since: revision.ingestedAt,
          version: 1,
        });
      }
      seeded += 1;
    }
    return { seeded };
  }

  private async restore(
    revisionId: string,
    since: Date,
    seed: SeedLakeInput['revisions'][number],
  ): Promise<void> {
    for (const chunk of seed.chunks) {
      for (const draft of chunk.claims) {
        if (draft.role !== 'afirma') continue;
        if (await this.baseline.find(draft.subject, draft.attribute)) continue;
        const claims = await this.claims.listFor(
          draft.subject,
          draft.attribute,
        );
        const claim = claims.find(
          (candidate) =>
            candidate.revisionId === revisionId && candidate.role === 'afirma',
        );
        if (!claim) continue;
        await this.baseline.upsert({
          subject: claim.subject,
          attribute: claim.attribute,
          value: claim.value,
          unit: claim.unit,
          claimId: claim.id,
          revisionId,
          proposalId: null,
          since,
          version: 1,
        });
      }
    }
  }
}
