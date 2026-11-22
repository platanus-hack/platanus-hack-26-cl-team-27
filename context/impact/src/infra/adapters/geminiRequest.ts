import { z } from 'zod';
import { InferenceUnavailableError } from '../../application/errors.ts';
import type { Evidence } from '../../domain/Evidence.ts';

export const GEMINI_MODEL = 'gemini-3.8-flash';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly fetch?: typeof fetch;
}

export type GeminiPart =
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

export const generateStructured = async <T>(
  options: GeminiOptions,
  system: string,
  parts: readonly GeminiPart[],
  schema: z.ZodType<T>,
): Promise<T> => {
  const model = options.model ?? GEMINI_MODEL;
  const send = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await send(`${GEMINI_URL}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': options.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: z.toJSONSchema(schema),
        },
      }),
    });
  } catch (error) {
    throw new InferenceUnavailableError('Gemini no respondió', {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new InferenceUnavailableError(`Gemini respondió ${response.status}`);
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
  const output = schema.safeParse(parsed);
  if (!output.success) {
    throw new InferenceUnavailableError(
      'La respuesta del modelo no cumple el formato',
    );
  }
  return output.data;
};
