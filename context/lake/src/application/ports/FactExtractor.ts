import type { ChunkDraft } from '../../domain/Chunk.ts';
import type { RevisionDraft } from '../../domain/Revision.ts';

export interface FactExtractor {
  extract(revision: RevisionDraft): Promise<ChunkDraft[]>;
}
