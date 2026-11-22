import {
  type AffectedEstimate,
  type AffectedEstimator,
  InferenceUnavailableError,
} from '@team27/context-impact';
import {
  anthropicClient,
  CachedAffectedEstimator,
  ClaudeAffectedEstimator,
  GeminiAffectedEstimator,
  MemoryResponseCache,
} from '@team27/context-impact/adapters';

import type { GeminiSettings } from './claim-reader.ts';

export const MISSING_ESTIMATOR_MESSAGE =
  'faltan ANTHROPIC_API_KEY y GEMINI_API_KEY, y sin una de ellas la API no sugiere afectados';

export class UnavailableAffectedEstimator implements AffectedEstimator {
  estimate(): Promise<AffectedEstimate[]> {
    return Promise.reject(
      new InferenceUnavailableError(MISSING_ESTIMATOR_MESSAGE),
    );
  }
}

export interface AffectedEstimatorChoice {
  readonly estimator: AffectedEstimator;
  readonly mode: 'claude' | 'gemini' | 'unavailable';
}

const present = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== '';

export const chooseAffectedEstimator = (
  apiKey: string | undefined,
  gemini: GeminiSettings = { apiKey: undefined },
): AffectedEstimatorChoice => {
  if (present(apiKey)) {
    return {
      mode: 'claude',
      estimator: new CachedAffectedEstimator(
        new ClaudeAffectedEstimator(anthropicClient(apiKey)),
        new MemoryResponseCache(),
        'claude',
      ),
    };
  }
  if (present(gemini.apiKey)) {
    return {
      mode: 'gemini',
      estimator: new CachedAffectedEstimator(
        new GeminiAffectedEstimator({
          apiKey: gemini.apiKey,
          ...(present(gemini.model) ? { model: gemini.model } : {}),
        }),
        new MemoryResponseCache(),
        'gemini',
      ),
    };
  }
  return { mode: 'unavailable', estimator: new UnavailableAffectedEstimator() };
};
