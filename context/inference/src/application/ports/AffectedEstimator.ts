import type { AffectedEstimate } from '../../domain/AffectedSuggestion.ts';
import type { ChangeSummary, Evidence } from '../../domain/Evidence.ts';
import type {
  ProjectVocabulary,
  VocabularyStakeholder,
} from '../../domain/Vocabulary.ts';

export interface AffectedQuery {
  readonly change: ChangeSummary;
  readonly vocabulary: ProjectVocabulary;
  readonly candidates: readonly VocabularyStakeholder[];
  readonly evidence: readonly Evidence[];
}

export interface AffectedEstimator {
  estimate(query: AffectedQuery): Promise<AffectedEstimate[]>;
}
