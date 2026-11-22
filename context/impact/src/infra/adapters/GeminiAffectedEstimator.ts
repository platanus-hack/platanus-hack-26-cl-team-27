import type {
  AffectedEstimator,
  AffectedQuery,
} from '../../application/ports/AffectedEstimator.ts';
import type { AffectedEstimate } from '../../domain/AffectedSuggestion.ts';
import {
  AFFECTED_SYSTEM,
  affectedPrompt,
  EstimatesSchema,
} from './ClaudeAffectedEstimator.ts';
import {
  generateStructured,
  geminiParts,
  type GeminiOptions,
} from './geminiRequest.ts';

export class GeminiAffectedEstimator implements AffectedEstimator {
  private readonly options: GeminiOptions;

  constructor(options: GeminiOptions) {
    this.options = options;
  }

  async estimate(query: AffectedQuery): Promise<AffectedEstimate[]> {
    const output = await generateStructured(
      this.options,
      AFFECTED_SYSTEM,
      [...geminiParts(query.evidence), { text: affectedPrompt(query) }],
      EstimatesSchema,
    );
    return output.estimates;
  }
}
