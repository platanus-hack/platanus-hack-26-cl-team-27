import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';
import type { RevisionRepository } from '../ports/RevisionRepository.ts';

export interface ClearScopeInput {
  readonly documentIds: readonly string[];
  readonly subjectPrefix: string;
}

export class ClearScope {
  private readonly revisions: RevisionRepository;
  private readonly proposals: ProposalRepository;
  private readonly baseline: BaselineRepository;

  constructor(
    revisions: RevisionRepository,
    proposals: ProposalRepository,
    baseline: BaselineRepository,
  ) {
    this.revisions = revisions;
    this.proposals = proposals;
    this.baseline = baseline;
  }

  async execute(input: ClearScopeInput): Promise<void> {
    await this.proposals.deleteByDocuments(input.documentIds);
    await this.revisions.deleteByDocuments(input.documentIds);
    await this.baseline.deleteBySubjectPrefix(input.subjectPrefix);
  }
}
