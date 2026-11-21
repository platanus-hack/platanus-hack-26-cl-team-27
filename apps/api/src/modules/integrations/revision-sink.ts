import { HttpException } from '@nestjs/common';
import {
  DeliveryError,
  type DeliveryReceipt,
  type RevisionDelivery,
  type RevisionSink,
} from '@team27/context-integrations';
import type { PrismaClient } from '@team27/data-main';

import { documentOf } from '../../scenario/documents.ts';
import type { CoordinationService } from '../coordination/coordination.service.ts';
import { readState } from '../room/state.ts';

type Ingested = Awaited<ReturnType<CoordinationService['ingest']>>;

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export const deliverySummary = (response: Ingested): string => {
  if (response.proposals.length > 0) {
    const notified = new Set(
      response.proposals.flatMap((proposal) => proposal.reviewers),
    );
    return `Llegó la revisión: abrimos ${plural(response.proposals.length, 'propuesta', 'propuestas')} y avisamos a ${plural(notified.size, 'persona', 'personas')}.`;
  }
  if (response.discrepancies.length > 0) {
    return 'Llegó la revisión: abrimos una discrepancia para el dueño del valor.';
  }
  return 'Llegó la revisión: la obra ya tenía esos valores.';
};

const messageOf = (error: HttpException): string => {
  const body = error.getResponse();
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && 'message' in body) {
    const { message } = body;
    if (typeof message === 'string') return message;
  }
  return error.message;
};

export class CoordinationRevisionSink implements RevisionSink {
  private readonly prisma: PrismaClient;
  private readonly coordination: CoordinationService;

  constructor(prisma: PrismaClient, coordination: CoordinationService) {
    this.prisma = prisma;
    this.coordination = coordination;
  }

  async epoch(): Promise<number | null> {
    if ((await this.prisma.revision.count()) === 0) return null;
    return (await readState(this.prisma)).epoch;
  }

  async deliver(delivery: RevisionDelivery): Promise<DeliveryReceipt> {
    const document = documentOf(delivery.documentId);
    try {
      const response = await this.coordination.ingest({
        seat: document.ownerId,
        revision: {
          documentId: delivery.documentId,
          label: delivery.label,
          spaceId: document.spaceId,
          pointer: delivery.pointer,
          contentHash: delivery.contentHash,
          chunks: delivery.chunks.map((chunk) => ({
            locator: chunk.locator,
            kind: chunk.kind,
            claims: chunk.claims.map((claim) => ({ ...claim })),
          })),
        },
        actionId: undefined,
      });
      return {
        revisionId: response.revisionId,
        proposals: response.proposals.length,
        summary: deliverySummary(response),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw new DeliveryError(messageOf(error));
      }
      throw error;
    }
  }
}
