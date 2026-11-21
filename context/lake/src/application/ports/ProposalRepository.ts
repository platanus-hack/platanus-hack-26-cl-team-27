import type {
  FilteredReviewer,
  Proposal,
  ProposalChange,
  ProposalContext,
  ProposalStatus,
} from '../../domain/Proposal.ts';

export interface NewProposal {
  readonly changeId: string | null;
  readonly changeIds: readonly string[];
  readonly documentId: string;
  readonly sourceRevisionId: string;
  readonly authorId: string;
  readonly changes: readonly ProposalChange[];
  readonly context: readonly ProposalContext[];
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
  deleteByDocuments(documentIds: readonly string[]): Promise<void>;
}
