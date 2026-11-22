import type {
  ConflictEstimator,
  ConflictQuery,
} from '../../application/ports/ConflictEstimator.ts';
import type { ConflictEstimate } from '../../domain/ConflictSuggestion.ts';
import {
  CONFLICTS_SYSTEM,
  conflictsPrompt,
  ConflictsSchema,
} from './ClaudeConflictEstimator.ts';
import { generateStructured, type GeminiOptions } from './geminiRequest.ts';

export class GeminiConflictEstimator implements ConflictEstimator {
  private readonly options: GeminiOptions;

  constructor(options: GeminiOptions) {
    this.options = options;
  }

  async estimate(query: ConflictQuery): Promise<ConflictEstimate[]> {
    const output = await generateStructured(
      this.options,
      CONFLICTS_SYSTEM,
      [{ text: conflictsPrompt(query) }],
      ConflictsSchema,
    );
    return output.conflicts;
  }
}
