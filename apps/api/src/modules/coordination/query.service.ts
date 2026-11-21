import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { GetChange, ListChanges } from '@team27/context-capture';
import { GetImpacts, type Impact } from '@team27/context-impact';
import {
  type BaselineRepository,
  type ClaimRepository,
  type DiscrepancyRepository,
  GetConsensus,
  GetProvenance,
  ListProposals,
  type ProposalRepository,
  type ProposalStatus,
  type RevisionRepository,
} from '@team27/context-lake';
import { ListNotifications } from '@team27/context-notification';

import type { SectionId } from '../../scenario/documents.ts';
import {
  BASELINE_REPOSITORY,
  CLAIM_REPOSITORY,
  DISCREPANCY_REPOSITORY,
  PROPOSAL_REPOSITORY,
  REVISION_REPOSITORY,
} from '../lake/lake.module.ts';
import { fail } from './http-errors.ts';
import {
  baselineResponse,
  changeView,
  type LakeSnapshot,
  proposalView,
  provenanceResponse,
  roomResponse,
  spacesResponse,
  trayResponse,
} from './views.ts';

export type ProposalFilter = ProposalStatus | 'active' | 'replaced';

@Injectable()
export class QueryService {
  private readonly revisions: RevisionRepository;
  private readonly claims: ClaimRepository;
  private readonly baseline: BaselineRepository;
  private readonly proposals: ProposalRepository;
  private readonly discrepancies: DiscrepancyRepository;
  private readonly getConsensus: GetConsensus;
  private readonly getProvenance: GetProvenance;
  private readonly listProposals: ListProposals;
  private readonly getImpacts: GetImpacts;
  private readonly listNotifications: ListNotifications;
  private readonly listChanges: ListChanges;
  private readonly getChange: GetChange;

  constructor(
    @Inject(REVISION_REPOSITORY) revisions: RevisionRepository,
    @Inject(CLAIM_REPOSITORY) claims: ClaimRepository,
    @Inject(BASELINE_REPOSITORY) baseline: BaselineRepository,
    @Inject(PROPOSAL_REPOSITORY) proposals: ProposalRepository,
    @Inject(DISCREPANCY_REPOSITORY) discrepancies: DiscrepancyRepository,
    @Inject(GetConsensus) getConsensus: GetConsensus,
    @Inject(GetProvenance) getProvenance: GetProvenance,
    @Inject(ListProposals) listProposals: ListProposals,
    @Inject(GetImpacts) getImpacts: GetImpacts,
    @Inject(ListNotifications) listNotifications: ListNotifications,
    @Inject(ListChanges) listChanges: ListChanges,
    @Inject(GetChange) getChange: GetChange,
  ) {
    this.revisions = revisions;
    this.claims = claims;
    this.baseline = baseline;
    this.proposals = proposals;
    this.discrepancies = discrepancies;
    this.getConsensus = getConsensus;
    this.getProvenance = getProvenance;
    this.listProposals = listProposals;
    this.getImpacts = getImpacts;
    this.listNotifications = listNotifications;
    this.listChanges = listChanges;
    this.getChange = getChange;
  }

  async isEmpty(): Promise<boolean> {
    return (await this.baseline.list()).length === 0;
  }

  async snapshot(): Promise<LakeSnapshot> {
    const [revisions, claims, baseline, proposals, discrepancies, consensus] =
      await Promise.all([
        this.revisions.list(),
        this.claims.list(),
        this.baseline.list(),
        this.proposals.list(),
        this.discrepancies.list(),
        this.getConsensus.execute(),
      ]);
    const changeIds = proposals.flatMap((proposal) =>
      proposal.changeId ? [proposal.changeId] : [],
    );
    const [impacts, notifications] = await Promise.all([
      this.getImpacts.execute(changeIds),
      this.listNotifications.execute({ changeIds }),
    ]);
    return {
      revisions,
      claims,
      baseline,
      proposals,
      discrepancies,
      consensus,
      impacts: new Map<string, Impact>(
        impacts.map((impact) => [impact.changeId, impact]),
      ),
      notifications,
    };
  }

  async room() {
    return roomResponse(await this.snapshot());
  }

  async baselineView(section: SectionId | undefined) {
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

  async tray(castId: string) {
    return trayResponse(await this.snapshot(), castId);
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
        snapshot.proposals.find((proposal) => proposal.changeId === change.id),
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
      snapshot.proposals.find((proposal) => proposal.changeId === change.id),
    );
  }
}
