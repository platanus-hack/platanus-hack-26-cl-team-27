import {
  type ClaimCandidate,
  type ClaimReader,
  InferenceUnavailableError,
} from '@team27/context-impact';
import {
  anthropicClient,
  CachedClaimReader,
  ClaudeClaimReader,
  MemoryResponseCache,
} from '@team27/context-impact/adapters';

export const MISSING_KEY_MESSAGE =
  'falta ANTHROPIC_API_KEY, y sin ella la API no lee texto libre';

export class UnavailableClaimReader implements ClaimReader {
  read(): Promise<ClaimCandidate[]> {
    return Promise.reject(new InferenceUnavailableError(MISSING_KEY_MESSAGE));
  }
}

export interface ClaimReaderChoice {
  readonly reader: ClaimReader;
  readonly mode: 'claude' | 'unavailable';
}

export const chooseClaimReader = (
  apiKey: string | undefined,
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
  return { mode: 'unavailable', reader: new UnavailableClaimReader() };
};
