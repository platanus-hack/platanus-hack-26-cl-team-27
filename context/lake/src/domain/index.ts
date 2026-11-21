export type { Acknowledgement, AcknowledgementDraft } from './Acknowledgement.ts';
export { AUTHORITY, hasAuthority } from './Authority.ts';
export type { AuthorityTable } from './Authority.ts';
export {
  baselineKey,
  sourcesOf,
  touchingProposals,
  valueStatus,
} from './Baseline.ts';
export type {
  BaselineEntry,
  BaselineHistoryItem,
  ValueStatus,
} from './Baseline.ts';
export { buildProvenance } from './buildProvenance.ts';
export type {
  Provenance,
  ProvenanceBacking,
  ProvenanceInput,
  ProvenancePrevious,
  ProvenanceSource,
} from './buildProvenance.ts';
export { sameValue } from './Claim.ts';
export type { Claim, ClaimDraft, ClaimRole, ClaimValue } from './Claim.ts';
export { classifyClaims } from './classifyClaims.ts';
export type {
  ClaimOutcome,
  ClaimOutcomeKind,
  ClassifyInput,
} from './classifyClaims.ts';
export { computeStaleness, staleSignature } from './computeStaleness.ts';
export type {
  StaleDocument,
  StaleItem,
  StalenessInput,
} from './computeStaleness.ts';
export { consensusIndex } from './consensusIndex.ts';
export type { ConsensusIndex, ConsensusInput } from './consensusIndex.ts';
export type {
  Discrepancy,
  DiscrepancyDraft,
  DiscrepancyResolution,
  DiscrepancyStatus,
} from './Discrepancy.ts';
export { DOCUMENT_KINDS } from './DocumentKind.ts';
export type { DocumentKind } from './DocumentKind.ts';
export { groupBySubject } from './groupBySubject.ts';
export type { DraftSource } from './groupBySubject.ts';
export {
  applyReview,
  decideProposal,
  isActive,
  reopenFor,
} from './Proposal.ts';
export type {
  Decision,
  FilteredReviewer,
  Proposal,
  ProposalChange,
  ProposalDraft,
  ProposalStatus,
  Review,
} from './Proposal.ts';
export { latestPerDocument } from './Revision.ts';
export type { Revision, RevisionDraft } from './Revision.ts';
export type { Space, SpaceKind } from './Space.ts';
