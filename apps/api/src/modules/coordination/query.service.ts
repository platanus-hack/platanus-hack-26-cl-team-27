import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Impact } from '@team27/context-impact';
import type { OverlapStatus, ProposalStatus } from '@team27/context-lake';
import type { PrismaClient } from '@team27/data-main';

import { PRISMA_CLIENT } from '../database/database.module.ts';
import { buildImpact } from '../impact/impact.module.ts';
import { buildLake } from '../lake/lake.module.ts';
import { buildNotification } from '../notification/notification.module.ts';
import type { ProjectCatalog } from '../project/project-catalog.ts';
import { fail } from './http-errors.ts';
import {
  areasResponse,
  baselineResponse,
  changeView,
  inboxResponse,
  type LakeSnapshot,
  overlapView,
  proposalView,
  provenanceResponse,
  spacesResponse,
} from './views.ts';

export type OverlapFilter = OverlapStatus | 'activo';

export type ProposalFilter = ProposalStatus | 'active' | 'replaced';

@Injectable()
export class QueryService {
  private readonly prisma: PrismaClient;

  constructor(@Inject(PRISMA_CLIENT) prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async snapshot(project: ProjectCatalog): Promise<LakeSnapshot> {
    const lake = buildLake(this.prisma, project);
    const [
      revisions,
      chunks,
      claims,
      baseline,
      proposals,
      discrepancies,
      overlaps,
      consensus,
    ] = await Promise.all([
      lake.ports.revisions.list(),
      lake.ports.chunks.list(),
      lake.ports.claims.list(),
      lake.ports.baseline.list(),
      lake.ports.proposals.list(),
      lake.ports.discrepancies.list(),
      lake.ports.overlaps.list(),
      lake.consensus.execute(),
    ]);
    const changeIds = [
      ...new Set(proposals.flatMap((proposal) => proposal.changeIds)),
    ];
    const [impacts, notifications] = await Promise.all([
      buildImpact(this.prisma, project).getImpacts.execute(changeIds),
      buildNotification(this.prisma, project).listNotifications.execute({
        changeIds,
      }),
    ]);
    return {
      project,
      revisions,
      chunks,
      claims,
      baseline,
      proposals,
      discrepancies,
      overlaps,
      consensus,
      impacts: new Map<string, Impact>(
        impacts.map((impact) => [impact.changeId, impact]),
      ),
      notifications,
    };
  }

  async inbox(project: ProjectCatalog, castId: string) {
    return inboxResponse(await this.snapshot(project), castId);
  }

  async baselineView(project: ProjectCatalog, section: string | undefined) {
    return baselineResponse(await this.snapshot(project), section);
  }

  async provenance(
    project: ProjectCatalog,
    subject: string,
    attribute: string,
  ) {
    const provenance = await buildLake(
      this.prisma,
      project,
    ).getProvenance.execute({ subject, attribute });
    if (!provenance) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No hay un valor vigente para ${subject}.${attribute}`,
      );
    }
    return provenanceResponse(await this.snapshot(project), provenance);
  }

  async spaces(project: ProjectCatalog) {
    return spacesResponse(await this.snapshot(project));
  }

  async proposalList(
    project: ProjectCatalog,
    filter: ProposalFilter | undefined,
  ) {
    const status = filter === 'replaced' ? 'superseded' : filter;
    const [list, snapshot] = await Promise.all([
      buildLake(this.prisma, project).listProposals.execute(
        status ? { status } : {},
      ),
      this.snapshot(project),
    ]);
    return {
      proposals: list.map((proposal) => proposalView(snapshot, proposal)),
    };
  }

  async overlapList(
    project: ProjectCatalog,
    filter: OverlapFilter | undefined,
  ) {
    const [list, snapshot] = await Promise.all([
      buildLake(this.prisma, project).listOverlaps.execute(
        filter ? { status: filter } : {},
      ),
      this.snapshot(project),
    ]);
    return { overlaps: list.map((overlap) => overlapView(snapshot, overlap)) };
  }

  async areas(project: ProjectCatalog) {
    return areasResponse(await this.snapshot(project));
  }

  async proposal(project: ProjectCatalog, id: string) {
    const snapshot = await this.snapshot(project);
    const proposal = snapshot.proposals.find((item) => item.id === id);
    if (!proposal) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe la propuesta ${id}`,
      );
    }
    return proposalView(snapshot, proposal);
  }

  async changes(project: ProjectCatalog, limit: number) {
    const [changes, snapshot] = await Promise.all([
      buildLake(this.prisma, project).listChanges.execute(limit),
      this.snapshot(project),
    ]);
    return changes.map((change) =>
      changeView(
        snapshot,
        change,
        snapshot.proposals.find((proposal) =>
          proposal.changeIds.includes(change.id),
        ),
      ),
    );
  }

  async change(project: ProjectCatalog, id: string) {
    const change = await buildLake(this.prisma, project).getChange.execute(id);
    if (!change) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe el cambio ${id}`,
      );
    }
    const snapshot = await this.snapshot(project);
    return changeView(
      snapshot,
      change,
      snapshot.proposals.find((proposal) =>
        proposal.changeIds.includes(change.id),
      ),
    );
  }
}
