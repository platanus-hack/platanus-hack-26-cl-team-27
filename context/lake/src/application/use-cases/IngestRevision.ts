import type { Claim, ClaimDraft } from '../../domain/Claim.ts';
import { classifyClaims } from '../../domain/classifyClaims.ts';
import type { ClaimOutcome } from '../../domain/classifyClaims.ts';
import type { Discrepancy } from '../../domain/Discrepancy.ts';
import { groupBySubject } from '../../domain/groupBySubject.ts';
import type { ProposalDraft } from '../../domain/Proposal.ts';
import type { Revision, RevisionDraft } from '../../domain/Revision.ts';
import { ValidationError } from '../errors.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { ClaimRepository } from '../ports/ClaimRepository.ts';
import type { DiscrepancyRepository } from '../ports/DiscrepancyRepository.ts';
import type { FactExtractor } from '../ports/FactExtractor.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';
import type { RevisionRepository } from '../ports/RevisionRepository.ts';

export interface IngestedRevision {
  readonly revision: Revision;
  readonly alreadyIngested: boolean;
  readonly claims: readonly Claim[];
  readonly outcomes: readonly ClaimOutcome[];
  readonly drafts: readonly ProposalDraft[];
  readonly openedDiscrepancies: readonly Discrepancy[];
  readonly backedDiscrepancies: readonly Discrepancy[];
}

const validate = (claims: readonly ClaimDraft[]): void => {
  const seen = new Set<string>();
  for (const claim of claims) {
    if (!claim.subject || !claim.attribute) {
      throw new ValidationError('Cada hecho necesita sujeto y atributo');
    }
    const key = `${claim.role}|${claim.subject}|${claim.attribute}`;
    if (seen.has(key)) {
      throw new ValidationError(
        `La revisión repite el hecho ${claim.subject}.${claim.attribute}`,
      );
    }
    seen.add(key);
  }
};

export class IngestRevision {
  private readonly revisions: RevisionRepository;
  private readonly claims: ClaimRepository;
  private readonly baseline: BaselineRepository;
  private readonly proposals: ProposalRepository;
  private readonly discrepancies: DiscrepancyRepository;
  private readonly extractor: FactExtractor;

  constructor(
    revisions: RevisionRepository,
    claims: ClaimRepository,
    baseline: BaselineRepository,
    proposals: ProposalRepository,
    discrepancies: DiscrepancyRepository,
    extractor: FactExtractor,
  ) {
    this.revisions = revisions;
    this.claims = claims;
    this.baseline = baseline;
    this.proposals = proposals;
    this.discrepancies = discrepancies;
    this.extractor = extractor;
  }

  async execute(input: RevisionDraft): Promise<IngestedRevision> {
    const existing = await this.revisions.findByKey(
      input.documentId,
      input.label,
    );
    if (existing) {
      return {
        revision: existing,
        alreadyIngested: true,
        claims: [],
        outcomes: [],
        drafts: [],
        openedDiscrepancies: [],
        backedDiscrepancies: [],
      };
    }

    const extracted = await this.extractor.extract(input);
    validate(extracted);
    const revision = await this.revisions.save(input);
    const claims = await this.claims.saveMany(revision.id, extracted);

    const [baseline, proposals, openDiscrepancies] = await Promise.all([
      this.baseline.list(),
      this.proposals.listActive(),
      this.discrepancies.listOpen(),
    ]);
    const outcomes = classifyClaims({
      kind: revision.kind,
      claims,
      baseline,
      proposals,
      discrepancies: openDiscrepancies,
    });
    const drafts = groupBySubject(outcomes, baseline, {
      revisionId: revision.id,
      authorId: revision.authorId,
    });

    const resolvedAt = new Date();
    const backedIds = new Set(
      outcomes.flatMap((outcome) => outcome.backsDiscrepancyIds),
    );
    const backedDiscrepancies: Discrepancy[] = [];
    for (const id of backedIds) {
      backedDiscrepancies.push(
        await this.discrepancies.resolve(id, {
          status: 'backed',
          backedByRevisionId: revision.id,
          note: null,
          resolvedAt,
        }),
      );
    }

    const known = openDiscrepancies.filter(
      (discrepancy) => !backedIds.has(discrepancy.id),
    );
    const openedDiscrepancies: Discrepancy[] = [];
    for (const outcome of outcomes) {
      if (outcome.kind !== 'discrepancy' || outcome.baselineValue === null) {
        continue;
      }
      const { claim } = outcome;
      const duplicate = [...known, ...openedDiscrepancies].some(
        (discrepancy) =>
          discrepancy.subject === claim.subject &&
          discrepancy.attribute === claim.attribute &&
          discrepancy.value === claim.value,
      );
      if (duplicate) continue;
      const entry = baseline.find(
        (candidate) =>
          candidate.subject === claim.subject &&
          candidate.attribute === claim.attribute,
      );
      const origin = entry
        ? await this.revisions.findById(entry.revisionId)
        : null;
      if (!origin) {
        throw new ValidationError(
          `El valor vigente de ${claim.subject}.${claim.attribute} no tiene revisión de origen`,
        );
      }
      openedDiscrepancies.push(
        await this.discrepancies.create({
          subject: claim.subject,
          attribute: claim.attribute,
          value: claim.value,
          baselineValue: outcome.baselineValue,
          unit: claim.unit,
          documentId: revision.documentId,
          revisionId: revision.id,
          claimId: claim.id,
          ownerId: origin.authorId,
        }),
      );
    }

    return {
      revision,
      alreadyIngested: false,
      claims,
      outcomes,
      drafts,
      openedDiscrepancies,
      backedDiscrepancies,
    };
  }
}
