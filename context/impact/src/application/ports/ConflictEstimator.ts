import type {
  ChangeBrief,
  ConflictEstimate,
} from '../../domain/ConflictSuggestion.ts';
import type { ProjectVocabulary } from '../../domain/Vocabulary.ts';

export interface ConflictQuery {
  readonly change: ChangeBrief;
  readonly others: readonly ChangeBrief[];
  readonly vocabulary: ProjectVocabulary;
}

export interface ConflictEstimator {
  estimate(query: ConflictQuery): Promise<ConflictEstimate[]>;
}
