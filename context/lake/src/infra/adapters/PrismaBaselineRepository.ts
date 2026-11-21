import type { Prisma, PrismaClient } from '@team27/data-main';

import type { BaselineRepository } from '../../application/ports/BaselineRepository.ts';
import type {
  BaselineEntry,
  BaselineHistoryItem,
} from '../../domain/Baseline.ts';
import type { ClaimValue } from '../../domain/Claim.ts';
import { toJson } from './json.ts';

type EntryRow = Prisma.BaselineEntryGetPayload<object>;
type HistoryRow = Prisma.BaselineHistoryGetPayload<object>;

const toEntry = (row: EntryRow): BaselineEntry => ({
  subject: row.subject,
  attribute: row.attribute,
  value: row.value as ClaimValue,
  unit: row.unit,
  claimId: row.claimId,
  revisionId: row.revisionId,
  proposalId: row.proposalId,
  since: row.since,
  version: row.version,
});

const toHistory = (row: HistoryRow): BaselineHistoryItem => ({
  subject: row.subject,
  attribute: row.attribute,
  value: row.value as ClaimValue,
  unit: row.unit,
  claimId: row.claimId,
  revisionId: row.revisionId,
  proposalId: row.proposalId,
  since: row.since,
  until: row.until,
});

export class PrismaBaselineRepository implements BaselineRepository {
  private readonly prisma: PrismaClient;
  private readonly projectId: string;

  constructor(prisma: PrismaClient, projectId: string) {
    this.prisma = prisma;
    this.projectId = projectId;
  }

  async list(): Promise<BaselineEntry[]> {
    const rows = await this.prisma.baselineEntry.findMany({
      where: { projectId: this.projectId },
      orderBy: [{ subject: 'asc' }, { attribute: 'asc' }],
    });
    return rows.map(toEntry);
  }

  async find(
    subject: string,
    attribute: string,
  ): Promise<BaselineEntry | null> {
    const row = await this.prisma.baselineEntry.findUnique({
      where: {
        projectId_subject_attribute: {
          projectId: this.projectId,
          subject,
          attribute,
        },
      },
    });
    return row ? toEntry(row) : null;
  }

  async upsert(entry: BaselineEntry): Promise<void> {
    const data = {
      value: toJson(entry.value),
      unit: entry.unit,
      claimId: entry.claimId,
      revisionId: entry.revisionId,
      proposalId: entry.proposalId,
      since: entry.since,
      version: entry.version,
    };
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.baselineEntry.findUnique({
        where: {
          projectId_subject_attribute: {
            projectId: this.projectId,
            subject: entry.subject,
            attribute: entry.attribute,
          },
        },
      });
      if (current) {
        await tx.baselineHistory.create({
          data: {
            projectId: this.projectId,
            subject: current.subject,
            attribute: current.attribute,
            value: toJson(current.value),
            unit: current.unit,
            claimId: current.claimId,
            revisionId: current.revisionId,
            proposalId: current.proposalId,
            since: current.since,
            until: entry.since,
          },
        });
        await tx.baselineEntry.update({
          where: {
            projectId_subject_attribute: {
              projectId: this.projectId,
              subject: entry.subject,
              attribute: entry.attribute,
            },
          },
          data,
        });
        return;
      }
      await tx.baselineEntry.create({
        data: {
          projectId: this.projectId,
          subject: entry.subject,
          attribute: entry.attribute,
          ...data,
        },
      });
    });
  }

  async history(
    subject: string,
    attribute: string,
  ): Promise<BaselineHistoryItem[]> {
    const rows = await this.prisma.baselineHistory.findMany({
      where: { projectId: this.projectId, subject, attribute },
      orderBy: { until: 'desc' },
    });
    return rows.map(toHistory);
  }

  async deleteBySubjectPrefix(prefix: string): Promise<void> {
    await this.prisma.baselineEntry.deleteMany({
      where: { projectId: this.projectId, subject: { startsWith: prefix } },
    });
    await this.prisma.baselineHistory.deleteMany({
      where: { projectId: this.projectId, subject: { startsWith: prefix } },
    });
  }

  async clear(): Promise<void> {
    await this.prisma.baselineEntry.deleteMany({
      where: { projectId: this.projectId },
    });
  }
}
