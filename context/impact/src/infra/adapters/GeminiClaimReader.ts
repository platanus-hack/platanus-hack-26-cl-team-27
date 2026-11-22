import type {
  ClaimQuery,
  ClaimReader,
} from '../../application/ports/ClaimReader.ts';
import type { ClaimCandidate } from '../../domain/ExtractedClaim.ts';
import {
  CLAIMS_SYSTEM,
  ClaimsSchema,
  claimsPrompt,
} from './ClaudeClaimReader.ts';
import {
  generateStructured,
  geminiParts,
  type GeminiOptions,
} from './geminiRequest.ts';

export class GeminiClaimReader implements ClaimReader {
  private readonly options: GeminiOptions;

  constructor(options: GeminiOptions) {
    this.options = options;
  }

  async read(query: ClaimQuery): Promise<ClaimCandidate[]> {
    const output = await generateStructured(
      this.options,
      CLAIMS_SYSTEM,
      [...geminiParts([query.evidence]), { text: claimsPrompt(query) }],
      ClaimsSchema,
    );
    return output.claims;
  }
}
