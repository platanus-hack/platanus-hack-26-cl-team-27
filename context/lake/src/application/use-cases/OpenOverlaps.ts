import type { FootprintModel } from '../../domain/AreaCell.ts';
import { detectOverlaps } from '../../domain/detectOverlaps.ts';
import { isLiveOverlap, overlapKey } from '../../domain/Overlap.ts';
import type { Overlap } from '../../domain/Overlap.ts';
import { ValidationError } from '../errors.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { ClaimRepository } from '../ports/ClaimRepository.ts';
import type { OverlapRepository } from '../ports/OverlapRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';
import type { RevisionRepository } from '../ports/RevisionRepository.ts';

export interface OpenOverlapsInput {
  readonly revisionId: string;
  readonly proposalIds: readonly string[];
}

export class OpenOverlaps {
  private readonly revisions: RevisionRepository;
  private readonly claims: ClaimRepository;
  private readonly baseline: BaselineRepository;
  private readonly proposals: ProposalRepository;
  private readonly overlaps: OverlapRepository;
  private readonly footprint: FootprintModel;

  constructor(
    revisions: RevisionRepository,
    claims: ClaimRepository,
    baseline: BaselineRepository,
    proposals: ProposalRepository,
    overlaps: OverlapRepository,
    footprint: FootprintModel,
  ) {
    this.revisions = revisions;
    this.claims = claims;
    this.baseline = baseline;
    this.proposals = proposals;
    this.overlaps = overlaps;
    this.footprint = footprint;
  }

  async execute(input: OpenOverlapsInput): Promise<Overlap[]> {
    const revision = await this.revisions.findById(input.revisionId);
    if (!revision) throw new ValidationError('La revisión no existe');
    if (input.proposalIds.length === 0) return [];

    const [revisions, claims, baseline, proposals, existing] =
      await Promise.all([
        this.revisions.list(),
        this.claims.list(),
        this.baseline.list(),
        this.proposals.list(),
        this.overlaps.list(),
      ]);
    const drafts = detectOverlaps({
      revision,
      revisions,
      claims,
      baseline,
      proposals,
      footprint: this.footprint,
      incoming: proposals.filter((proposal) =>
        input.proposalIds.includes(proposal.id),
      ),
    });
    const known = new Set(
      existing
        .filter(
          (overlap) =>
            isLiveOverlap(overlap) || overlap.status === 'descartado',
        )
        .map(overlapKey),
    );
    const opened: Overlap[] = [];
    for (const draft of drafts) {
      if (known.has(overlapKey(draft))) continue;
      opened.push(await this.overlaps.create(draft));
    }
    return opened;
  }
}
