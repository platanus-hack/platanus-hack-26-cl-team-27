import {
  InferenceUnavailableError,
  type NoticeReason,
  type ReasonWriter,
} from '@team27/context-impact';
import {
  anthropicClient,
  CachedReasonWriter,
  ClaudeReasonWriter,
  GeminiReasonWriter,
  MemoryResponseCache,
} from '@team27/context-impact/adapters';

import type { GeminiSettings } from './claim-reader.ts';

export const MISSING_REASON_MESSAGE =
  'faltan ANTHROPIC_API_KEY y GEMINI_API_KEY, y sin una de ellas los avisos llevan el porqué fijo';

export class UnavailableReasonWriter implements ReasonWriter {
  write(): Promise<NoticeReason[]> {
    return Promise.reject(
      new InferenceUnavailableError(MISSING_REASON_MESSAGE),
    );
  }
}

export interface ReasonWriterChoice {
  readonly writer: ReasonWriter;
  readonly mode: 'claude' | 'gemini' | 'unavailable';
}

const present = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== '';

export const chooseReasonWriter = (
  apiKey: string | undefined,
  gemini: GeminiSettings = { apiKey: undefined },
): ReasonWriterChoice => {
  if (present(apiKey)) {
    return {
      mode: 'claude',
      writer: new CachedReasonWriter(
        new ClaudeReasonWriter(anthropicClient(apiKey)),
        new MemoryResponseCache(),
        'claude',
      ),
    };
  }
  if (present(gemini.apiKey)) {
    return {
      mode: 'gemini',
      writer: new CachedReasonWriter(
        new GeminiReasonWriter({
          apiKey: gemini.apiKey,
          ...(present(gemini.model) ? { model: gemini.model } : {}),
        }),
        new MemoryResponseCache(),
        'gemini',
      ),
    };
  }
  return { mode: 'unavailable', writer: new UnavailableReasonWriter() };
};
