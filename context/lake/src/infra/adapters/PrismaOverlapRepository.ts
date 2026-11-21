import type { Prisma, PrismaClient } from '@team27/data-main';

import type { OverlapRepository } from '../../application/ports/OverlapRepository.ts';
import type { OverlapRelation } from '../../domain/AreaCell.ts';
import type {
  Overlap,
  OverlapBacking,
  OverlapDraft,
  OverlapKind,
  OverlapResolution,
  OverlapStatus,
  OverlapVoteKind,
} from '../../domain/Overlap.ts';
import { toJson } from './json.ts';

type OverlapRow = Prisma.OverlapGetPayload<{ include: { votes: true } }>;

const toOverlap = (row: OverlapRow): Overlap => ({
  id: row.id,
  proposalId: row.proposalId,
  otherProposalId: row.otherProposalId,
  revisionId: row.revisionId,
  chunkLocator: row.chunkLocator,
  kind: row.kind as OverlapKind,
  area:
    row.nivel !== null && row.celda !== null
      ? {
          nivel: row.nivel,
          celda: row.celda,
          sistemas: row.sistemas as unknown as string[],
        }
      : null,
  relation: row.relation as OverlapRelation | null,
  subjectId: row.subjectId,
  otherSubjectId: row.otherSubjectId,
  otherBacking: row.otherBacking as unknown as OverlapBacking,
  validators: row.validators as unknown as string[],
  status: row.status as OverlapStatus,
  votes: [...row.votes]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((vote) => ({
      validatorId: vote.validatorId,
      kind: vote.kind as OverlapVoteKind,
      note: vote.note,
      at: vote.at,
    })),
  resolution: row.resolution as OverlapResolution | null,
  createdAt: row.createdAt,
  resolvedAt: row.resolvedAt,
});

export class PrismaOverlapRepository implements OverlapRepository {
  private readonly prisma: PrismaClient;
  private readonly projectId: string;

  constructor(prisma: PrismaClient, projectId: string) {
    this.prisma = prisma;
    this.projectId = projectId;
  }

  async create(draft: OverlapDraft): Promise<Overlap> {
    const row = await this.prisma.overlap.create({
      data: {
        projectId: this.projectId,
        proposalId: draft.proposalId,
        otherProposalId: draft.otherProposalId,
        revisionId: draft.revisionId,
        chunkLocator: draft.chunkLocator,
        kind: draft.kind,
        nivel: draft.area?.nivel ?? null,
        celda: draft.area?.celda ?? null,
        sistemas: toJson(draft.area?.sistemas ?? []),
        relation: draft.relation,
        subjectId: draft.subjectId,
        otherSubjectId: draft.otherSubjectId,
        otherBacking: toJson(draft.otherBacking),
        validators: toJson(draft.validators),
      },
      include: { votes: true },
    });
    return toOverlap(row);
  }

  async save(overlap: Overlap): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.overlap.update({
        where: { id: overlap.id, projectId: this.projectId },
        data: {
          status: overlap.status,
          resolution: overlap.resolution,
          resolvedAt: overlap.resolvedAt,
        },
      }),
      ...overlap.votes.map((vote) =>
        this.prisma.overlapVote.upsert({
          where: {
            overlapId_validatorId: {
              overlapId: overlap.id,
              validatorId: vote.validatorId,
            },
          },
          create: {
            overlapId: overlap.id,
            validatorId: vote.validatorId,
            kind: vote.kind,
            note: vote.note,
            at: vote.at,
          },
          update: { kind: vote.kind, note: vote.note, at: vote.at },
        }),
      ),
    ]);
  }

  async findById(id: string): Promise<Overlap | null> {
    const row = await this.prisma.overlap.findUnique({
      where: { id, projectId: this.projectId },
      include: { votes: true },
    });
    return row ? toOverlap(row) : null;
  }

  async list(): Promise<Overlap[]> {
    const rows = await this.prisma.overlap.findMany({
      where: { projectId: this.projectId },
      include: { votes: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toOverlap);
  }

  async listLive(): Promise<Overlap[]> {
    const rows = await this.prisma.overlap.findMany({
      where: {
        projectId: this.projectId,
        status: { in: ['abierto', 'confirmado'] },
      },
      include: { votes: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toOverlap);
  }

  async clear(): Promise<void> {
    await this.prisma.overlap.deleteMany({
      where: { projectId: this.projectId },
    });
  }
}
