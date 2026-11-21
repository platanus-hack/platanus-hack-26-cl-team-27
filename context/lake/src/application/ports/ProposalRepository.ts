import type {
  FilteredReviewer,
  Proposal,
  ProposalChange,
  ProposalStatus,
} from '../../domain/Proposal.ts';

export interface NewProposal {
  readonly changeId: string | null;
  readonly subject: string;
  readonly sourceRevisionId: string;
  readonly authorId: string;
  readonly changes: readonly ProposalChange[];
  readonly reviewerIds: readonly string[];
  readonly filtered: readonly FilteredReviewer[];
  readonly openedAt: Date;
}

export interface ProposalRepository {
  create(proposal: NewProposal): Promise<Proposal>;
  save(proposal: Proposal): Promise<void>;
  findById(id: string): Promise<Proposal | null>;
  list(status?: ProposalStatus): Promise<Proposal[]>;
  listActive(): Promise<Proposal[]>;
  clear(): Promise<void>;
}
