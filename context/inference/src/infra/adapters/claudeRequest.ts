import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { InferenceUnavailableError } from '../../application/errors.ts';
import type { Evidence } from '../../domain/Evidence.ts';
import type { ProjectVocabulary } from '../../domain/Vocabulary.ts';

export const CLAUDE_MODEL = 'claude-opus-5-5';

export const anthropicClient = (apiKey: string): Anthropic =>
  new Anthropic({ apiKey });

export type ClaudeEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ClaudeOptions {
  readonly model?: string;
  readonly effort?: ClaudeEffort;
  readonly maxTokens?: number;
}

const DEFAULT_MAX_TOKENS = 16000;

const headerOf = (evidence: Evidence): string =>
  `«${evidence.title}» (${evidence.source})`;

const fileBlock = (
  evidence: Extract<Evidence, { kind: 'file' }>,
): Anthropic.Beta.BetaContentBlockParam => {
  if (evidence.mediaType === 'application/pdf') {
    return {
      type: 'document',
      title: evidence.title,
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: evidence.data,
      },
    };
  }
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: evidence.mediaType,
      data: evidence.data,
    },
  };
};

export const evidenceBlocks = (
  evidence: readonly Evidence[],
): Anthropic.Beta.BetaContentBlockParam[] =>
  evidence.flatMap((item): Anthropic.Beta.BetaContentBlockParam[] =>
    item.kind === 'text'
      ? [{ type: 'text', text: `${headerOf(item)}:\n${item.text}` }]
      : [
          fileBlock(item),
          { type: 'text', text: `El archivo anterior es ${headerOf(item)}.` },
        ],
  );

export const vocabularyText = (vocabulary: ProjectVocabulary): string =>
  [
    `Proyecto: ${vocabulary.project}`,
    'Elementos y atributos del proyecto (sujeto.atributo [unidad]: descripción):',
    ...vocabulary.subjects.flatMap((subject) =>
      subject.attributes.map(
        (attribute) =>
          `- ${subject.id}.${attribute.key} [${attribute.unit ?? 'sin unidad'}]: ${subject.label}, ${attribute.label}`,
      ),
    ),
  ].join('\n');

export const parseStructured = async <Schema extends z.ZodType>(
  client: Anthropic,
  options: ClaudeOptions,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  schema: Schema,
): Promise<z.infer<Schema>> => {
  let response;
  try {
    response = await client.beta.messages.parse({
      model: options.model ?? CLAUDE_MODEL,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: options.effort ?? 'medium',
        format: betaZodOutputFormat(schema),
      },
      system,
      messages: [{ role: 'user', content }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new InferenceUnavailableError(
        `El modelo no respondió: ${error.message}`,
        { cause: error },
      );
    }
    throw error;
  }
  if (response.stop_reason === 'refusal') {
    throw new InferenceUnavailableError('El modelo declinó la consulta');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new InferenceUnavailableError(
      'La respuesta del modelo quedó cortada',
    );
  }
  if (response.parsed_output === null || response.parsed_output === undefined) {
    throw new InferenceUnavailableError(
      'La respuesta del modelo no cumple el formato',
    );
  }
  return response.parsed_output;
};
