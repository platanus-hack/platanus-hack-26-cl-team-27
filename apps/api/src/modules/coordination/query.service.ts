import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DetectConflicts,
  ExplainNotices,
  type Impact,
  SuggestAffected,
} from '@team27/context-impact';
import type {
  Overlap,
  OverlapStatus,
  ProposalStatus,
} from '@team27/context-lake';
import { isChangeNotice } from '@team27/context-notification';
import type { PrismaClient } from '@team27/data-main';

import type { Env } from '../../config/index.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { buildImpact } from '../impact/impact.module.ts';
import { buildVocabulary } from '../impact/vocabulary.ts';
import { buildLake } from '../lake/lake.module.ts';
import { buildNotification } from '../notification/notification.module.ts';
import type { ProjectCatalog } from '../project/project-catalog.ts';
import { fail } from './http-errors.ts';
import {
  briefOf,
  CONFLICT_WINDOW,
  detectForChange,
  liveOverlapsOf,
} from './conflicts.ts';
import { combinedImpactOf } from './impact.ts';
import {
  conflictPreviews,
  estimatedClashes,
  noticePreviews,
  overlapClashes,
  reasonsFor,
} from './notices.ts';
import { suggestForChange } from './suggestions.ts';
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
  private readonly suggest: SuggestAffected;
  private readonly detect: DetectConflicts;
  private readonly explain: ExplainNotices;
  private readonly baseUrl: string;
  private readonly detecting = new Map<
    string,
    ReturnType<QueryService['detectConflicts']>
  >();

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(SuggestAffected) suggest: SuggestAffected,
    @Inject(DetectConflicts) detect: DetectConflicts,
    @Inject(ExplainNotices) explain: ExplainNotices,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.prisma = prisma;
    this.suggest = suggest;
    this.detect = detect;
    this.explain = explain;
    this.baseUrl = config.get('APP_BASE_URL', { infer: true });
  }

  conflicts(project: ProjectCatalog, id: string) {
    const key = `${project.id}/${id}`;
    const running = this.detecting.get(key);
    if (running) return running;
    const started = this.detectConflicts(project, id).finally(() => {
      this.detecting.delete(key);
    });
    this.detecting.set(key, started);
    return started;
  }

  async notices(project: ProjectCatalog, id: string) {
    const [analysis, snapshot] = await Promise.all([
      this.conflicts(project, id),
      this.snapshot(project),
    ]);
    const change = await buildLake(this.prisma, project).getChange.execute(id);
    if (!change) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe el cambio ${id}`,
      );
    }
    const proposal = snapshot.proposals.find((item) =>
      item.changeIds.includes(change.id),
    );
    const notifications = snapshot.notifications
      .filter((notification) => notification.changeId === change.id)
      .sort(
        (a, b) =>
          project.stakeholders.findIndex(
            (member) => member.id === a.stakeholderId,
          ) -
          project.stakeholders.findIndex(
            (member) => member.id === b.stakeholderId,
          ),
      );
    const { reasons, inference } = await reasonsFor(
      this.explain,
      briefOf(change),
      project,
      notifications,
    );
    const impact = snapshot.impacts.get(change.id);
    const overlapIds = new Set(
      snapshot.overlaps
        .filter(
          (overlap) =>
            proposal !== undefined &&
            (overlap.proposalId === proposal.id ||
              overlap.otherProposalId === proposal.id),
        )
        .map((overlap) => overlap.id),
    );
    const teamOrder = (stakeholderId: string): number =>
      project.cast.findIndex((member) => member.id === stakeholderId);
    const conflictNotices = snapshot.conflictNotices
      .filter(
        (notification) =>
          notification.changeId === change.id ||
          overlapIds.has(notification.context?.conflict?.overlapId ?? ''),
      )
      .sort((a, b) => teamOrder(a.stakeholderId) - teamOrder(b.stakeholderId));
    const deliveries = await buildNotification(
      this.prisma,
      project,
    ).listDeliveries.execute(
      [...notifications, ...conflictNotices].map((item) => item.id),
    );
    return {
      changeId: change.id,
      inference,
      conflictNotices: conflictPreviews({
        project,
        notifications: conflictNotices,
        deliveries,
        baseUrl: this.baseUrl,
      }),
      notices: noticePreviews({
        deliveries,
        project,
        notifications,
        impact: impact
          ? { costDelta: impact.costDelta, delayDays: impact.delayDays }
          : null,
        clashes: [
          ...(proposal
            ? overlapClashes({
                project,
                overlaps: snapshot.overlaps,
                proposals: snapshot.proposals,
                impacts: snapshot.impacts,
                proposalId: proposal.id,
                changeId: change.id,
              })
            : []),
          ...estimatedClashes(
            analysis.conflicts,
            snapshot.impacts,
            change.id,
            project.graph,
          ),
        ],
        reasons,
        baseUrl: this.baseUrl,
      }),
    };
  }

  private async detectConflicts(project: ProjectCatalog, id: string) {
    const lake = buildLake(this.prisma, project);
    const change = await lake.getChange.execute(id);
    if (!change) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe el cambio ${id}`,
      );
    }
    const [recent, snapshot] = await Promise.all([
      lake.listChanges.execute(CONFLICT_WINDOW + 1),
      this.snapshot(project),
    ]);
    const proposal = snapshot.proposals.find((item) =>
      item.changeIds.includes(change.id),
    );
    const result = await detectForChange(this.detect, {
      change,
      others: recent,
      vocabulary: buildVocabulary(project),
    });
    const byId = new Map(recent.map((item) => [item.id, item]));
    const withChange = (item: (typeof result.conflicts)[number]) => {
      const other = byId.get(item.otherChangeId);
      return {
        ...item,
        otherSummary: other?.summary ?? item.otherChangeId,
        otherElement: other?.element ?? null,
        otherDetectedAt: other?.detectedAt ?? null,
      };
    };
    const combinedWith = (otherChangeIds: readonly string[]) =>
      combinedImpactOf(
        snapshot.impacts,
        [change.id, ...otherChangeIds],
        project.graph,
      );
    const otherChangeIdsOf = (overlap: Overlap): string[] => {
      const otherProposalId =
        overlap.proposalId === proposal?.id
          ? overlap.otherProposalId
          : overlap.proposalId;
      return (
        snapshot.proposals
          .find((item) => item.id === otherProposalId)
          ?.changeIds.filter((item) => item !== change.id) ?? []
      );
    };
    return {
      changeId: change.id,
      overlaps: liveOverlapsOf(
        snapshot.overlaps,
        change,
        proposal?.id ?? null,
      ).map((overlap) => ({
        ...overlapView(snapshot, overlap),
        combinedImpact: combinedWith(otherChangeIdsOf(overlap)),
      })),
      conflicts: result.conflicts.map((item) => ({
        ...withChange(item),
        combinedImpact: combinedWith([item.otherChangeId]),
      })),
      watch: result.watch.map(withChange),
      inference: result.inference,
      inferenceMessage: result.inferenceMessage,
    };
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
    const [impacts, notices] = await Promise.all([
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
      notifications: notices.filter(isChangeNotice),
      conflictNotices: notices.filter((notice) => !isChangeNotice(notice)),
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

  async suggestions(project: ProjectCatalog, id: string) {
    const change = await buildLake(this.prisma, project).getChange.execute(id);
    if (!change) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe el cambio ${id}`,
      );
    }
    const snapshot = await this.snapshot(project);
    const proposal = snapshot.proposals.find((item) =>
      item.changeIds.includes(change.id),
    );
    const notifiedIds = snapshot.notifications
      .filter((notification) => notification.changeId === change.id)
      .map((notification) => notification.stakeholderId);
    const split = await suggestForChange(this.suggest, {
      change,
      vocabulary: buildVocabulary(project),
      notifiedIds,
      authorId: proposal?.authorId ?? null,
    });
    const withPerson = (item: (typeof split.ask)[number]) => {
      const member = project.castMember(item.stakeholderId);
      return {
        ...item,
        name: member?.name ?? item.stakeholderId,
        role: member?.role ?? null,
      };
    };
    return {
      changeId: change.id,
      notifiedIds,
      ask: split.ask.map(withPerson),
      watch: split.watch.map(withPerson),
    };
  }
}
