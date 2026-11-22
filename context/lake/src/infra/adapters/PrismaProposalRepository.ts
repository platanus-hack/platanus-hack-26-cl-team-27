import type { Prisma, PrismaClient } from '@team27/data-main';

import type {
  NewProposal,
  ProposalRepository,
} from '../../application/ports/ProposalRepository.ts';
import type {
  Decision,
  FilteredReviewer,
  Proposal,
  ProposalChange,
  ProposalContext,
  ProposalStatus,
} from '../../domain/Proposal.ts';
import { toJson } from './json.ts';

type ProposalRow = Prisma.ProposalGetPayload<{ include: { reviews: true } }>;

const toProposal = (row: ProposalRow): Proposal => ({
  id: row.id,
  changeId: row.changeId,
  changeIds: row.changeIds as unknown as string[],
  documentId: row.documentId,
  sourceRevisionId: row.sourceRevisionId,
  authorId: row.authorId,
  changes: row.changes as unknown as ProposalChange[],
  context: row.context as unknown as ProposalContext[],
  status: row.status as ProposalStatus,
  reviews: [...row.reviews]
    .sort((a, b) => a.reviewerId.localeCompare(b.reviewerId))
    .map((review) => ({
      reviewerId: review.reviewerId,
      decision: review.decision as Decision | null,
      note: review.note,
      at: review.at,
    })),
  filtered: row.filtered as unknown as FilteredReviewer[],
  openedAt: row.openedAt,
  resolvedAt: row.resolvedAt,
  supersededById: row.supersededById,
});

export class PrismaProposalRepository implements ProposalRepository {
  private readonly prisma: PrismaClient;
  private readonly projectId: string;

  constructor(prisma: PrismaClient, projectId: string) {
    this.prisma = prisma;
    this.projectId = projectId;
  }

  async create(proposal: NewProposal): Promise<Proposal> {
    const row = await this.prisma.proposal.create({
      data: {
        projectId: this.projectId,
        changeId: proposal.changeId,
        changeIds: toJson(proposal.changeIds),
        documentId: proposal.documentId,
        sourceRevisionId: proposal.sourceRevisionId,
        authorId: proposal.authorId,
        changes: toJson(proposal.changes),
        context: toJson(proposal.context),
        filtered: toJson(proposal.filtered),
        status: 'open',
        openedAt: proposal.openedAt,
        reviews: {
          create: proposal.reviewerIds.map((reviewerId) => ({ reviewerId })),
        },
      },
      include: { reviews: true },
    });
    return toProposal(row);
  }

  async save(proposal: Proposal): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.proposal.update({
        where: { id: proposal.id, projectId: this.projectId },
        data: {
          status: proposal.status,
          resolvedAt: proposal.resolvedAt,
          supersededById: proposal.supersededById,
          filtered: toJson(proposal.filtered),
        },
      }),
      this.prisma.review.deleteMany({
        where: {
          proposalId: proposal.id,
          reviewerId: {
            notIn: proposal.reviews.map((review) => review.reviewerId),
          },
        },
      }),
      ...proposal.reviews.map((review) =>
        this.prisma.review.update({
          where: {
            proposalId_reviewerId: {
              proposalId: proposal.id,
              reviewerId: review.reviewerId,
            },
          },
          data: { decision: review.decision, note: review.note, at: review.at },
        }),
      ),
    ]);
  }

  async findById(id: string): Promise<Proposal | null> {
    const row = await this.prisma.proposal.findUnique({
      where: { id, projectId: this.projectId },
      include: { reviews: true },
    });
    return row ? toProposal(row) : null;
  }

  async list(status?: ProposalStatus): Promise<Proposal[]> {
    const rows = await this.prisma.proposal.findMany({
      where: { projectId: this.projectId, ...(status ? { status } : {}) },
      include: { reviews: true },
      orderBy: { openedAt: 'asc' },
    });
    return rows.map(toProposal);
  }

  async listActive(): Promise<Proposal[]> {
    const rows = await this.prisma.proposal.findMany({
      where: {
        projectId: this.projectId,
        status: { in: ['open', 'disputed'] },
      },
      include: { reviews: true },
      orderBy: { openedAt: 'asc' },
    });
    return rows.map(toProposal);
  }

  async clear(): Promise<void> {
    await this.prisma.proposal.deleteMany({
      where: { projectId: this.projectId },
    });
  }
}
