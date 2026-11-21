import type { Evidence } from '../../domain/Evidence.ts';
import type { ClaimCandidate } from '../../domain/ExtractedClaim.ts';
import type { ProjectVocabulary } from '../../domain/Vocabulary.ts';

export interface ClaimQuery {
  readonly evidence: Evidence;
  readonly vocabulary: ProjectVocabulary;
}

export interface ClaimReader {
  read(query: ClaimQuery): Promise<ClaimCandidate[]>;
}
