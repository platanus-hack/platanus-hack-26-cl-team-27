import {
  type ConflictEstimate,
  type ConflictEstimator,
  InferenceUnavailableError,
} from '@team27/context-impact';
import {
  anthropicClient,
  ClaudeConflictEstimator,
  GeminiConflictEstimator,
  PairedConflictEstimator,
} from '@team27/context-impact/adapters';

import type { GeminiSettings } from './claim-reader.ts';

export const MISSING_CONFLICT_MESSAGE =
  'faltan ANTHROPIC_API_KEY y GEMINI_API_KEY, y sin una de ellas la API no estima choques entre cambios';

export class UnavailableConflictEstimator implements ConflictEstimator {
  estimate(): Promise<ConflictEstimate[]> {
    return Promise.reject(
      new InferenceUnavailableError(MISSING_CONFLICT_MESSAGE),
    );
  }
}

export interface ConflictEstimatorChoice {
  readonly estimator: ConflictEstimator;
  readonly mode: 'claude' | 'gemini' | 'unavailable';
}

const present = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== '';

export const chooseConflictEstimator = (
  apiKey: string | undefined,
  gemini: GeminiSettings = { apiKey: undefined },
): ConflictEstimatorChoice => {
  if (present(apiKey)) {
    return {
      mode: 'claude',
      estimator: new PairedConflictEstimator(
        new ClaudeConflictEstimator(anthropicClient(apiKey)),
      ),
    };
  }
  if (present(gemini.apiKey)) {
    return {
      mode: 'gemini',
      estimator: new PairedConflictEstimator(
        new GeminiConflictEstimator({
          apiKey: gemini.apiKey,
          ...(present(gemini.model) ? { model: gemini.model } : {}),
        }),
      ),
    };
  }
  return { mode: 'unavailable', estimator: new UnavailableConflictEstimator() };
};
