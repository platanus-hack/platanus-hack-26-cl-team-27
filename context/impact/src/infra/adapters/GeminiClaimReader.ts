import { z } from 'zod';
import { InferenceUnavailableError } from '../../application/errors.ts';
import type {
  ClaimQuery,
  ClaimReader,
} from '../../application/ports/ClaimReader.ts';
import type { Evidence } from '../../domain/Evidence.ts';
import type { ClaimCandidate } from '../../domain/ExtractedClaim.ts';
import {
  CLAIMS_SYSTEM,
  ClaimsSchema,
  claimsPrompt,
} from './ClaudeClaimReader.ts';

export const GEMINI_MODEL = 'gemini-3.8-flash';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly fetch?: typeof fetch;
}

type GeminiPart =
  { text: string } | { inline_data: { mime_type: string; data: string } };

const GeminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })) })
          .optional(),
      }),
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
});

const headerOf = (evidence: Evidence): string =>
  `«${evidence.title}» (${evidence.source})`;

export const geminiParts = (evidence: readonly Evidence[]): GeminiPart[] =>
  evidence.flatMap((item): GeminiPart[] =>
    item.kind === 'text'
      ? [{ text: `${headerOf(item)}:\n${item.text}` }]
      : [
          { inline_data: { mime_type: item.mediaType, data: item.data } },
          { text: `El archivo anterior es ${headerOf(item)}.` },
        ],
  );

export class GeminiClaimReader implements ClaimReader {
  private readonly options: GeminiOptions;

  constructor(options: GeminiOptions) {
    this.options = options;
  }

  async read(query: ClaimQuery): Promise<ClaimCandidate[]> {
    const model = this.options.model ?? GEMINI_MODEL;
    const send = this.options.fetch ?? fetch;
    let response: Response;
    try {
      response = await send(`${GEMINI_URL}/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.options.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: CLAIMS_SYSTEM }] },
          contents: [
            {
              role: 'user',
              parts: [
                ...geminiParts([query.evidence]),
                { text: claimsPrompt(query) },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: z.toJSONSchema(ClaimsSchema),
          },
        }),
      });
    } catch (error) {
      throw new InferenceUnavailableError('Gemini no respondió', {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new InferenceUnavailableError(
        `Gemini respondió ${response.status}`,
      );
    }
    const body = GeminiResponseSchema.safeParse(await response.json());
    const candidate = body.success ? body.data.candidates?.[0] : undefined;
    if (body.success && body.data.promptFeedback?.blockReason) {
      throw new InferenceUnavailableError('El modelo declinó la consulta');
    }
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new InferenceUnavailableError(
        'La respuesta del modelo quedó cortada',
      );
    }
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    const claims = ClaimsSchema.safeParse(parsed);
    if (!claims.success) {
      throw new InferenceUnavailableError(
        'La respuesta del modelo no cumple el formato',
      );
    }
    return claims.data.claims;
  }
}
