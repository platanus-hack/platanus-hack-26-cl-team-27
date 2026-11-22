import {
  type ClaimCandidate,
  type ClaimReader,
  InferenceUnavailableError,
} from '@team27/context-impact';
import {
  anthropicClient,
  CachedClaimReader,
  ClaudeClaimReader,
  GeminiClaimReader,
  MemoryResponseCache,
} from '@team27/context-impact/adapters';

export const MISSING_KEY_MESSAGE =
  'faltan ANTHROPIC_API_KEY y GEMINI_API_KEY, y sin una de ellas la API no lee texto libre';

export class UnavailableClaimReader implements ClaimReader {
  read(): Promise<ClaimCandidate[]> {
    return Promise.reject(new InferenceUnavailableError(MISSING_KEY_MESSAGE));
  }
}

export interface ClaimReaderChoice {
  readonly reader: ClaimReader;
  readonly mode: 'claude' | 'gemini' | 'unavailable';
}

export interface GeminiSettings {
  readonly apiKey: string | undefined;
  readonly model?: string | undefined;
}

const present = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== '';

export const chooseClaimReader = (
  apiKey: string | undefined,
  gemini: GeminiSettings = { apiKey: undefined },
): ClaimReaderChoice => {
  if (apiKey !== undefined && apiKey.trim() !== '') {
    return {
      mode: 'claude',
      reader: new CachedClaimReader(
        new ClaudeClaimReader(anthropicClient(apiKey)),
        new MemoryResponseCache(),
        'claude',
      ),
    };
  }
  if (present(gemini.apiKey)) {
    return {
      mode: 'gemini',
      reader: new CachedClaimReader(
        new GeminiClaimReader({
          apiKey: gemini.apiKey,
          ...(present(gemini.model) ? { model: gemini.model } : {}),
        }),
        new MemoryResponseCache(),
        'gemini',
      ),
    };
  }
  return { mode: 'unavailable', reader: new UnavailableClaimReader() };
};
