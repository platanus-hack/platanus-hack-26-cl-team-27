import { latestPerDocument } from '../../domain/Revision.ts';
import { sourcesOf, touchingProposals, valueStatus } from '../../domain/Baseline.ts';
import type { BaselineEntry, ValueStatus } from '../../domain/Baseline.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { ClaimRepository } from '../ports/ClaimRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';
import type { RevisionRepository } from '../ports/RevisionRepository.ts';

export interface BaselineView {
  readonly entry: BaselineEntry;
  readonly status: ValueStatus;
  readonly sources: number;
  readonly proposalIds: readonly string[];
}

export class GetBaseline {
  private readonly revisions: RevisionRepository;
  private readonly claims: ClaimRepository;
  private readonly baseline: BaselineRepository;
  private readonly proposals: ProposalRepository;

  constructor(
    revisions: RevisionRepository,
    claims: ClaimRepository,
    baseline: BaselineRepository,
    proposals: ProposalRepository,
  ) {
    this.revisions = revisions;
    this.claims = claims;
    this.baseline = baseline;
    this.proposals = proposals;
  }

  async execute(): Promise<BaselineView[]> {
    const [revisions, claims, entries, proposals] = await Promise.all([
      this.revisions.list(),
      this.claims.list(),
      this.baseline.list(),
      this.proposals.listActive(),
    ]);
    const current = new Set(latestPerDocument(revisions).map((r) => r.id));
    return entries.map((entry) => ({
      entry,
      status: valueStatus(entry, proposals),
      sources: sourcesOf(entry, claims, current).length,
      proposalIds: touchingProposals(entry, proposals).map((p) => p.id),
    }));
  }
}
