import type { Chunk, ChunkDraft } from '../domain/Chunk.ts';
import type { Claim } from '../domain/Claim.ts';
import type { ChunkRepository } from './ports/ChunkRepository.ts';
import type { ClaimRepository } from './ports/ClaimRepository.ts';

export interface PersistedChunks {
  readonly chunks: Chunk[];
  readonly claims: Claim[];
}

export const persistChunks = async (
  chunks: ChunkRepository,
  claims: ClaimRepository,
  revisionId: string,
  drafts: readonly ChunkDraft[],
): Promise<PersistedChunks> => {
  const savedChunks = await chunks.saveMany(revisionId, drafts);
  const inserts = drafts.flatMap((draft, index) =>
    draft.claims.map((claim) => ({
      ...claim,
      locator: draft.locator,
      confidence: claim.confidence ?? null,
      chunkId: savedChunks[index]?.id ?? null,
    })),
  );
  const savedClaims = await claims.saveMany(revisionId, inserts);
  return { chunks: savedChunks, claims: savedClaims };
};
