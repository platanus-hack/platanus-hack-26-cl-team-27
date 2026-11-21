import type { Chunk, ChunkDraft } from '../../domain/Chunk.ts';

export interface ChunkRepository {
  saveMany(revisionId: string, drafts: readonly ChunkDraft[]): Promise<Chunk[]>;
  list(): Promise<Chunk[]>;
  clear(): Promise<void>;
}
