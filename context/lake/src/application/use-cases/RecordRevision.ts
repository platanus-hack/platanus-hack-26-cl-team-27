import type { Chunk, ChunkDraft } from '../../domain/Chunk.ts';
import type { Claim } from '../../domain/Claim.ts';
import type { Revision, RevisionDraft } from '../../domain/Revision.ts';
import { persistChunks } from '../persistChunks.ts';
import type { ChunkRepository } from '../ports/ChunkRepository.ts';
import type { ClaimRepository } from '../ports/ClaimRepository.ts';
import type { RevisionRepository } from '../ports/RevisionRepository.ts';

export interface RecordRevisionInput {
  readonly revision: RevisionDraft;
  readonly chunks: readonly ChunkDraft[];
}

export interface RecordedRevision {
  readonly revision: Revision;
  readonly chunks: readonly Chunk[];
  readonly claims: readonly Claim[];
  readonly alreadyRecorded: boolean;
}

export class RecordRevision {
  private readonly revisions: RevisionRepository;
  private readonly chunks: ChunkRepository;
  private readonly claims: ClaimRepository;

  constructor(
    revisions: RevisionRepository,
    chunks: ChunkRepository,
    claims: ClaimRepository,
  ) {
    this.revisions = revisions;
    this.chunks = chunks;
    this.claims = claims;
  }

  async execute(input: RecordRevisionInput): Promise<RecordedRevision> {
    const existing = await this.revisions.findByKey(
      input.revision.documentId,
      input.revision.label,
    );
    if (existing) {
      return {
        revision: existing,
        chunks: [],
        claims: [],
        alreadyRecorded: true,
      };
    }
    const revision = await this.revisions.save(input.revision);
    const saved = await persistChunks(
      this.chunks,
      this.claims,
      revision.id,
      input.chunks,
    );
    return { revision, ...saved, alreadyRecorded: false };
  }
}
