import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type {
  ClaimQuery,
  ClaimReader,
} from '../../application/ports/ClaimReader.ts';
import type { ClaimCandidate } from '../../domain/ExtractedClaim.ts';
import {
  evidenceBlocks,
  parseStructured,
  vocabularyText,
  type ClaudeOptions,
} from './claudeRequest.ts';

const ClaimsSchema = z.object({
  claims: z.array(
    z.object({
      subject: z.string(),
      attribute: z.string(),
      value: z.union([z.number(), z.string(), z.boolean()]),
      unit: z.string().nullable(),
      role: z.enum(['afirma', 'usa']),
      locator: z.string(),
      confidence: z.number(),
    }),
  ),
});

export const CLAIMS_SYSTEM = `Lees documentos de obra (planos, especificaciones técnicas, cotizaciones, mensajes de WhatsApp y folios del libro de obra) y extraes afirmaciones sobre propiedades de los elementos del proyecto.

- Usa solo los sujetos y atributos del vocabulario del proyecto, con su unidad. Si algo no calza con el vocabulario, no lo incluyas.
- role es «afirma» si el documento declara el valor, y «usa» si el documento se calculó sobre ese valor o depende de él.
- locator dice dónde lo leíste: página, cajetín, celda, eje o la frase del mensaje.
- confidence, de 0 a 1, mide qué tan segura es tu lectura. Un mensaje informal o ambiguo lleva confianza baja; un plano con cota legible, alta.
- No inventes valores. Si no hay afirmaciones, devuelve una lista vacía.`;

export const claimsPrompt = (query: ClaimQuery): string =>
  [
    vocabularyText(query.vocabulary),
    '',
    `Extrae las afirmaciones de «${query.evidence.title}».`,
  ].join('\n');

export class ClaudeClaimReader implements ClaimReader {
  private readonly client: Anthropic;
  private readonly options: ClaudeOptions;

  constructor(client: Anthropic, options: ClaudeOptions = {}) {
    this.client = client;
    this.options = options;
  }

  async read(query: ClaimQuery): Promise<ClaimCandidate[]> {
    const output = await parseStructured(
      this.client,
      this.options,
      CLAIMS_SYSTEM,
      [
        ...evidenceBlocks([query.evidence]),
        { type: 'text', text: claimsPrompt(query) },
      ],
      ClaimsSchema,
    );
    return output.claims;
  }
}
