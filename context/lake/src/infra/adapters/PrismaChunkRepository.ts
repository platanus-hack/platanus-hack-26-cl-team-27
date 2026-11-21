import type { Prisma, PrismaClient } from '@team27/data-main';

import type { ChunkRepository } from '../../application/ports/ChunkRepository.ts';
import type {
  Chunk,
  ChunkDraft,
  ChunkKind,
  RejectedClaimDraft,
} from '../../domain/Chunk.ts';
import { toJson } from './json.ts';

type ChunkRow = Prisma.ChunkGetPayload<object>;

const toChunk = (row: ChunkRow): Chunk => ({
  id: row.id,
  revisionId: row.revisionId,
  position: row.position,
  locator: row.locator,
  kind: row.kind as ChunkKind,
  text: row.text,
  rejected: row.rejected as unknown as RejectedClaimDraft[],
});

export class PrismaChunkRepository implements ChunkRepository {
  private readonly prisma: PrismaClient;
  private readonly projectId: string;

  constructor(prisma: PrismaClient, projectId: string) {
    this.prisma = prisma;
    this.projectId = projectId;
  }

  async saveMany(
    revisionId: string,
    drafts: readonly ChunkDraft[],
  ): Promise<Chunk[]> {
    const rows = await this.prisma.$transaction(
      drafts.map((draft, position) =>
        this.prisma.chunk.create({
          data: {
            projectId: this.projectId,
            revisionId,
            position,
            locator: draft.locator,
            kind: draft.kind,
            text: draft.text,
            rejected: toJson(draft.rejected),
          },
        }),
      ),
    );
    return rows.map(toChunk);
  }

  async list(): Promise<Chunk[]> {
    const rows = await this.prisma.chunk.findMany({
      where: { projectId: this.projectId },
      orderBy: [{ revision: { ingestOrder: 'asc' } }, { position: 'asc' }],
    });
    return rows.map(toChunk);
  }

  async clear(): Promise<void> {
    await this.prisma.chunk.deleteMany({
      where: { projectId: this.projectId },
    });
  }
}
