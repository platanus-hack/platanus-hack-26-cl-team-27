import type { FactExtractor } from '../../application/ports/FactExtractor.ts';
import type { ChunkDraft } from '../../domain/Chunk.ts';

export class InlineFactExtractor implements FactExtractor {
  private readonly chunks: readonly ChunkDraft[];

  constructor(chunks: readonly ChunkDraft[]) {
    this.chunks = chunks;
  }

  extract(): Promise<ChunkDraft[]> {
    return Promise.resolve([...this.chunks]);
  }
}
