import { hasAuthority } from '../../domain/Authority.ts';
import { baselineKey } from '../../domain/Baseline.ts';
import type { BaselineEntry } from '../../domain/Baseline.ts';
import type { ClaimDraft } from '../../domain/Claim.ts';
import type { RevisionDraft } from '../../domain/Revision.ts';
import { ValidationError } from '../errors.ts';
import type { AcknowledgementRepository } from '../ports/AcknowledgementRepository.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { ClaimRepository } from '../ports/ClaimRepository.ts';
import type { DiscrepancyRepository } from '../ports/DiscrepancyRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';
import type { RevisionRepository } from '../ports/RevisionRepository.ts';

export interface SeedRevision {
  readonly revision: RevisionDraft;
  readonly claims: readonly ClaimDraft[];
}

export interface SeedLakeInput {
  readonly revisions: readonly SeedRevision[];
}

export interface SeededLake {
  readonly revisions: number;
  readonly baseline: readonly BaselineEntry[];
}

export class SeedLake {
  private readonly revisions: RevisionRepository;
  private readonly claims: ClaimRepository;
  private readonly baseline: BaselineRepository;
  private readonly proposals: ProposalRepository;
  private readonly discrepancies: DiscrepancyRepository;
  private readonly acknowledgements: AcknowledgementRepository;

  constructor(
    revisions: RevisionRepository,
    claims: ClaimRepository,
    baseline: BaselineRepository,
    proposals: ProposalRepository,
    discrepancies: DiscrepancyRepository,
    acknowledgements: AcknowledgementRepository,
  ) {
    this.revisions = revisions;
    this.claims = claims;
    this.baseline = baseline;
    this.proposals = proposals;
    this.discrepancies = discrepancies;
    this.acknowledgements = acknowledgements;
  }

  async execute(input: SeedLakeInput): Promise<SeededLake> {
    await this.acknowledgements.clear();
    await this.discrepancies.clear();
    await this.proposals.clear();
    await this.baseline.clear();
    await this.claims.clear();
    await this.revisions.clear();

    const entries = new Map<string, BaselineEntry>();
    for (const seed of input.revisions) {
      const revision = await this.revisions.save(seed.revision);
      const claims = await this.claims.saveMany(revision.id, seed.claims);
      for (const claim of claims) {
        if (
          claim.role !== 'afirma' ||
          !hasAuthority(revision.kind, claim.attribute)
        ) {
          continue;
        }
        const key = baselineKey(claim.subject, claim.attribute);
        const existing = entries.get(key);
        if (existing) {
          if (existing.value !== claim.value) {
            throw new ValidationError(
              `La base de ${claim.subject}.${claim.attribute} tiene dos valores con autoridad`,
            );
          }
          continue;
        }
        entries.set(key, {
          subject: claim.subject,
          attribute: claim.attribute,
          value: claim.value,
          unit: claim.unit,
          claimId: claim.id,
          revisionId: revision.id,
          proposalId: null,
          since: revision.ingestedAt,
          version: 1,
        });
      }
    }
    for (const entry of entries.values()) await this.baseline.upsert(entry);
    return { revisions: input.revisions.length, baseline: [...entries.values()] };
  }
}
