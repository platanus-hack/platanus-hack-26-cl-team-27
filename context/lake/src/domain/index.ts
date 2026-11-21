export type {
  Acknowledgement,
  AcknowledgementDraft,
} from './Acknowledgement.ts';
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
export type {
  Change,
  ChangeDraft,
  ChangeKind,
  ChangedElement,
  PropertyDiff,
} from './Change.ts';
export { describeDiffs, diffSnapshots, formatValue } from './diffSnapshots.ts';
export { NO_FOOTPRINT, sameFootprint, sharedAreas } from './AreaCell.ts';
export type {
  AreaCell,
  Footprint,
  FootprintModel,
  OverlapRelation,
  SharedArea,
  SpatialKind,
} from './AreaCell.ts';
export { CHUNK_KINDS, chunksFromClaims } from './Chunk.ts';
export type {
  Chunk,
  ChunkDraft,
  ChunkKind,
  RejectedClaimDraft,
} from './Chunk.ts';
export {
  activeFor,
  baselineValues,
  detectOverlaps,
  finalValues,
  reassessOverlaps,
} from './detectOverlaps.ts';
export type {
  DetectOverlapsInput,
  OverlapContext,
  OverlapResolutionItem,
} from './detectOverlaps.ts';
export {
  applyOverlapVote,
  blocksProposal,
  decideOverlap,
  isLiveOverlap,
  overlapKey,
} from './Overlap.ts';
export type {
  Overlap,
  OverlapBacking,
  OverlapDraft,
  OverlapKind,
  OverlapResolution,
  OverlapStatus,
  OverlapVote,
  OverlapVoteKind,
} from './Overlap.ts';
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
export type {
  ModelElement,
  ModelProperty,
  PropertyValue,
} from './ModelElement.ts';
export type { DocumentKind } from './DocumentKind.ts';
export { buildProposalDraft } from './buildProposalDraft.ts';
export type { DraftSource } from './buildProposalDraft.ts';
export {
  applyReview,
  decideProposal,
  isActive,
  reopenFor,
  subjectsOf,
  touches,
} from './Proposal.ts';
export type {
  Decision,
  FilteredReviewer,
  Proposal,
  ProposalChange,
  ProposalContext,
  ProposalDraft,
  ProposalStatus,
  Review,
  SubjectValues,
} from './Proposal.ts';
export { latestPerDocument } from './Revision.ts';
export type { Revision, RevisionDraft } from './Revision.ts';
export type { Space, SpaceKind } from './Space.ts';
export * from './spatial/index.ts';
