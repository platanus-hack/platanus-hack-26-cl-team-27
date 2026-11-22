import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type {
  AffectedEstimator,
  AffectedQuery,
} from '../../application/ports/AffectedEstimator.ts';
import type { AffectedEstimate } from '../../domain/AffectedSuggestion.ts';
import {
  evidenceBlocks,
  parseStructured,
  vocabularyText,
  type ClaudeOptions,
} from './claudeRequest.ts';

export const EstimatesSchema = z.object({
  estimates: z.array(
    z.object({
      stakeholderId: z.string(),
      probability: z.number(),
      reason: z.string(),
      evidence: z.string(),
      question: z.string(),
    }),
  ),
});

export const AFFECTED_SYSTEM = `Coordinas proyectos de construcción y conoces el trabajo de todas las disciplinas: estructura, arquitectura, instalaciones sanitarias y eléctricas, terminaciones, costos, plazos y proveedores.

Recibes un cambio en un elemento del proyecto, las personas que las reglas del proyecto NO avisaron y la evidencia disponible (planos, especificaciones, mensajes). Para cada persona, estima la probabilidad, de 0 a 1, de que su trabajo dependa de ese cambio aunque las reglas no la hayan incluido.

- Básate en su rol y en la evidencia. Si la evidencia no dice nada, usa lo habitual en obra y baja la probabilidad.
- En evidence, cita la fuente y el lugar (título, página, cajetín, línea), o escribe «sin evidencia directa». No inventes datos.
- En reason, explica en una frase qué parte de su trabajo podría depender del cambio.
- En question, escribe una pregunta corta en español de Chile, con tuteo, que esa persona pueda contestar con sí o no para confirmar si le afecta.
- No calcules costos ni plazos: de eso se encargan las reglas del proyecto.
- Devuelve una estimación por persona, con su id exacto.`;

export const affectedPrompt = (query: AffectedQuery): string => {
  const { change } = query;
  const unit = change.unit ? ` ${change.unit}` : '';
  return [
    vocabularyText(query.vocabulary),
    '',
    `Cambio: ${change.summary} (${change.subjectId}.${change.attribute}: ${String(change.before)}${unit} → ${String(change.after)}${unit}).`,
    '',
    'Personas que las reglas no avisaron (id | nombre | rol):',
    ...query.candidates.map(
      (candidate) =>
        `- ${candidate.id} | ${candidate.name} | ${candidate.role}`,
    ),
  ].join('\n');
};

export class ClaudeAffectedEstimator implements AffectedEstimator {
  private readonly client: Anthropic;
  private readonly options: ClaudeOptions;

  constructor(client: Anthropic, options: ClaudeOptions = {}) {
    this.client = client;
    this.options = options;
  }

  async estimate(query: AffectedQuery): Promise<AffectedEstimate[]> {
    const output = await parseStructured(
      this.client,
      this.options,
      AFFECTED_SYSTEM,
      [
        ...evidenceBlocks(query.evidence),
        { type: 'text', text: affectedPrompt(query) },
      ],
      EstimatesSchema,
    );
    return output.estimates;
  }
}
