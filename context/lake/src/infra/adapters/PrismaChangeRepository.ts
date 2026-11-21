import type { Prisma, PrismaClient } from '@team27/data-main';

import type { ChangeRepository } from '../../application/ports/ChangeRepository.ts';
import type {
  Change,
  ChangeDraft,
  ChangeKind,
  PropertyDiff,
} from '../../domain/Change.ts';
import type { PropertyValue } from '../../domain/ModelElement.ts';

type ChangeRow = Prisma.ChangeGetPayload<object>;

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const toChange = (row: ChangeRow): Change => ({
  id: row.id,
  sourceId: row.sourceId,
  element: { id: row.elementId, name: row.elementName, category: row.category },
  kind: row.kind as ChangeKind,
  summary: row.summary,
  diffs: row.diffs as unknown as PropertyDiff[],
  before: row.before as unknown as Record<string, PropertyValue>,
  after: row.after as unknown as Record<string, PropertyValue>,
  detectedAt: row.detectedAt,
});

export class PrismaChangeRepository implements ChangeRepository {
  private readonly prisma: PrismaClient;
  private readonly projectId: string;

  constructor(prisma: PrismaClient, projectId: string) {
    this.prisma = prisma;
    this.projectId = projectId;
  }

  async saveMany(drafts: readonly ChangeDraft[]): Promise<Change[]> {
    const rows = await this.prisma.$transaction(
      drafts.map((draft) =>
        this.prisma.change.create({
          data: {
            projectId: this.projectId,
            sourceId: draft.sourceId,
            elementId: draft.element.id,
            elementName: draft.element.name,
            category: draft.element.category,
            kind: draft.kind,
            summary: draft.summary,
            diffs: toJson(draft.diffs),
            before: toJson(draft.before),
            after: toJson(draft.after),
          },
        }),
      ),
    );
    return rows.map(toChange);
  }

  async listRecent(limit: number): Promise<Change[]> {
    const rows = await this.prisma.change.findMany({
      where: { projectId: this.projectId },
      orderBy: [{ detectedAt: 'desc' }, { elementName: 'asc' }],
      take: limit,
    });
    return rows.map(toChange);
  }

  async findById(id: string): Promise<Change | null> {
    const row = await this.prisma.change.findUnique({
      where: { id, projectId: this.projectId },
    });
    return row ? toChange(row) : null;
  }
}
