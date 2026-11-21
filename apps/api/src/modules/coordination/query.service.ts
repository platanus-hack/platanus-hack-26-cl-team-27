import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { GetImpacts, type Impact } from '@team27/context-impact';
import {
  type BaselineRepository,
  type ChunkRepository,
  type ClaimRepository,
  type DiscrepancyRepository,
  GetChange,
  GetConsensus,
  GetProvenance,
  ListChanges,
  ListOverlaps,
  ListProposals,
  type OverlapRepository,
  type OverlapStatus,
  type ProposalRepository,
  type ProposalStatus,
  type RevisionRepository,
} from '@team27/context-lake';
import { ListNotifications } from '@team27/context-notification';

import type { ProjectCatalog } from '../project/project-catalog.ts';
import { PROJECT_CATALOG } from '../project/project.module.ts';
import {
  BASELINE_REPOSITORY,
  CHUNK_REPOSITORY,
  CLAIM_REPOSITORY,
  DISCREPANCY_REPOSITORY,
  OVERLAP_REPOSITORY,
  PROPOSAL_REPOSITORY,
  REVISION_REPOSITORY,
} from '../lake/lake.module.ts';
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
  type RoomExtras,
  roomResponse,
  spacesResponse,
} from './views.ts';

export type OverlapFilter = OverlapStatus | 'activo';

export type ProposalFilter = ProposalStatus | 'active' | 'replaced';

@Injectable()
export class QueryService {
  private readonly revisions: RevisionRepository;
  private readonly chunks: ChunkRepository;
  private readonly claims: ClaimRepository;
  private readonly baseline: BaselineRepository;
  private readonly proposals: ProposalRepository;
  private readonly discrepancies: DiscrepancyRepository;
  private readonly overlaps: OverlapRepository;
  private readonly getConsensus: GetConsensus;
  private readonly getProvenance: GetProvenance;
  private readonly listProposals: ListProposals;
  private readonly listOverlaps: ListOverlaps;
  private readonly getImpacts: GetImpacts;
  private readonly listNotifications: ListNotifications;
  private readonly listChanges: ListChanges;
  private readonly getChange: GetChange;
  private readonly project: ProjectCatalog;

  constructor(
    @Inject(REVISION_REPOSITORY) revisions: RevisionRepository,
    @Inject(CHUNK_REPOSITORY) chunks: ChunkRepository,
    @Inject(CLAIM_REPOSITORY) claims: ClaimRepository,
    @Inject(BASELINE_REPOSITORY) baseline: BaselineRepository,
    @Inject(PROPOSAL_REPOSITORY) proposals: ProposalRepository,
    @Inject(DISCREPANCY_REPOSITORY) discrepancies: DiscrepancyRepository,
    @Inject(OVERLAP_REPOSITORY) overlaps: OverlapRepository,
    @Inject(GetConsensus) getConsensus: GetConsensus,
    @Inject(GetProvenance) getProvenance: GetProvenance,
    @Inject(ListProposals) listProposals: ListProposals,
    @Inject(ListOverlaps) listOverlaps: ListOverlaps,
    @Inject(GetImpacts) getImpacts: GetImpacts,
    @Inject(ListNotifications) listNotifications: ListNotifications,
    @Inject(ListChanges) listChanges: ListChanges,
    @Inject(GetChange) getChange: GetChange,
    @Inject(PROJECT_CATALOG) project: ProjectCatalog,
  ) {
    this.revisions = revisions;
    this.chunks = chunks;
    this.claims = claims;
    this.baseline = baseline;
    this.proposals = proposals;
    this.discrepancies = discrepancies;
    this.overlaps = overlaps;
    this.getConsensus = getConsensus;
    this.getProvenance = getProvenance;
    this.listProposals = listProposals;
    this.listOverlaps = listOverlaps;
    this.getImpacts = getImpacts;
    this.listNotifications = listNotifications;
    this.listChanges = listChanges;
    this.getChange = getChange;
    this.project = project;
  }

  async snapshot(): Promise<LakeSnapshot> {
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
      this.revisions.list(),
      this.chunks.list(),
      this.claims.list(),
      this.baseline.list(),
      this.proposals.list(),
      this.discrepancies.list(),
      this.overlaps.list(),
      this.getConsensus.execute(),
    ]);
    const changeIds = [
      ...new Set(proposals.flatMap((proposal) => proposal.changeIds)),
    ];
    const [impacts, notifications] = await Promise.all([
      this.getImpacts.execute(changeIds),
      this.listNotifications.execute({ changeIds }),
    ]);
    return {
      project: this.project,
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

  async room(extras: RoomExtras) {
    return roomResponse(await this.snapshot(), extras);
  }

  async inbox(castId: string) {
    return inboxResponse(await this.snapshot(), castId);
  }

  async baselineView(section: string | undefined) {
    return baselineResponse(await this.snapshot(), section);
  }

  async provenance(subject: string, attribute: string) {
    const provenance = await this.getProvenance.execute({ subject, attribute });
    if (!provenance) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No hay un valor vigente para ${subject}.${attribute}`,
      );
    }
    return provenanceResponse(await this.snapshot(), provenance);
  }

  async spaces() {
    return spacesResponse(await this.snapshot());
  }

  async proposalList(filter: ProposalFilter | undefined) {
    const status = filter === 'replaced' ? 'superseded' : filter;
    const [list, snapshot] = await Promise.all([
      this.listProposals.execute(status ? { status } : {}),
      this.snapshot(),
    ]);
    return {
      proposals: list.map((proposal) => proposalView(snapshot, proposal)),
    };
  }

  async overlapList(filter: OverlapFilter | undefined) {
    const [list, snapshot] = await Promise.all([
      this.listOverlaps.execute(filter ? { status: filter } : {}),
      this.snapshot(),
    ]);
    return { overlaps: list.map((overlap) => overlapView(snapshot, overlap)) };
  }

  async overlap(id: string) {
    const snapshot = await this.snapshot();
    const found = snapshot.overlaps.find((overlap) => overlap.id === id);
    if (!found) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe el solapamiento ${id}`,
      );
    }
    return overlapView(snapshot, found);
  }

  async areas() {
    return areasResponse(await this.snapshot());
  }

  async proposal(id: string) {
    const snapshot = await this.snapshot();
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

  async changes(limit: number) {
    const [changes, snapshot] = await Promise.all([
      this.listChanges.execute(limit),
      this.snapshot(),
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

  async change(id: string) {
    const change = await this.getChange.execute(id);
    if (!change) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe el cambio ${id}`,
      );
    }
    const snapshot = await this.snapshot();
    return changeView(
      snapshot,
      change,
      snapshot.proposals.find((proposal) =>
        proposal.changeIds.includes(change.id),
      ),
    );
  }
}
