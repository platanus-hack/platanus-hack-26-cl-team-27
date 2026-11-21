import { buildProvenance } from '../../domain/buildProvenance.ts';
import type { Provenance } from '../../domain/buildProvenance.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { ClaimRepository } from '../ports/ClaimRepository.ts';
import type { DiscrepancyRepository } from '../ports/DiscrepancyRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';
import type { RevisionRepository } from '../ports/RevisionRepository.ts';

export interface GetProvenanceInput {
  readonly subject: string;
  readonly attribute: string;
}

export class GetProvenance {
  private readonly revisions: RevisionRepository;
  private readonly claims: ClaimRepository;
  private readonly baseline: BaselineRepository;
  private readonly proposals: ProposalRepository;
  private readonly discrepancies: DiscrepancyRepository;

  constructor(
    revisions: RevisionRepository,
    claims: ClaimRepository,
    baseline: BaselineRepository,
    proposals: ProposalRepository,
    discrepancies: DiscrepancyRepository,
  ) {
    this.revisions = revisions;
    this.claims = claims;
    this.baseline = baseline;
    this.proposals = proposals;
    this.discrepancies = discrepancies;
  }

  async execute(input: GetProvenanceInput): Promise<Provenance | null> {
    const entry = await this.baseline.find(input.subject, input.attribute);
    if (!entry) return null;
    const [history, revisions, claims, proposals, discrepancies] =
      await Promise.all([
        this.baseline.history(input.subject, input.attribute),
        this.revisions.list(),
        this.claims.list(),
        this.proposals.list(),
        this.discrepancies.list(),
      ]);
    return buildProvenance({
      entry,
      history,
      revisions,
      claims,
      proposals,
      discrepancies,
    });
  }
}
