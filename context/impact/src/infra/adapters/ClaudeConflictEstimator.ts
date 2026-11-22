import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type {
  ConflictEstimator,
  ConflictQuery,
} from '../../application/ports/ConflictEstimator.ts';
import type {
  ChangeBrief,
  ConflictEstimate,
} from '../../domain/ConflictSuggestion.ts';
import {
  parseStructured,
  vocabularyText,
  type ClaudeOptions,
} from './claudeRequest.ts';

export const ConflictsSchema = z.object({
  conflicts: z.array(
    z.object({
      otherChangeId: z.string(),
      probability: z.number(),
      reason: z.string(),
      question: z.string(),
    }),
  ),
});

export const CONFLICTS_SYSTEM = `Coordinas proyectos de construcción y conoces el trabajo de todas las disciplinas: estructura, arquitectura, instalaciones sanitarias y eléctricas, terminaciones, costos, plazos y proveedores.

Recibes un cambio en un elemento del proyecto y otros cambios recientes del mismo proyecto. Para cada otro cambio, estima la probabilidad, de 0 a 1, de que choque con el primero: que ocupen el mismo lugar, que uno invalide al otro, que se contradigan o que no puedan ejecutarse los dos tal como están.

- Básate en los elementos, los atributos y los valores. Si no hay una relación física o de dependencia clara, baja la probabilidad.
- En reason, explica en una frase por qué podrían chocar, o por qué no. No inventes datos.
- En question, escribe una pregunta corta en español de Chile, con tuteo, que los autores de los dos cambios puedan contestar con sí o no para confirmar si se tocan.
- No calcules costos ni plazos.
- Devuelve una estimación por cada otro cambio, con su id exacto.`;

const briefLine = (brief: ChangeBrief): string =>
  `- ${brief.id} | ${brief.subjectId} | ${brief.detectedAt} | ${brief.summary}`;

export const conflictsPrompt = (query: ConflictQuery): string =>
  [
    vocabularyText(query.vocabulary),
    '',
    'Cambio a revisar (id | elemento | fecha | resumen):',
    briefLine(query.change),
    '',
    'Otros cambios recientes (id | elemento | fecha | resumen):',
    ...query.others.map(briefLine),
  ].join('\n');

export class ClaudeConflictEstimator implements ConflictEstimator {
  private readonly client: Anthropic;
  private readonly options: ClaudeOptions;

  constructor(client: Anthropic, options: ClaudeOptions = {}) {
    this.client = client;
    this.options = options;
  }

  async estimate(query: ConflictQuery): Promise<ConflictEstimate[]> {
    const output = await parseStructured(
      this.client,
      this.options,
      CONFLICTS_SYSTEM,
      [{ type: 'text', text: conflictsPrompt(query) }],
      ConflictsSchema,
    );
    return output.conflicts;
  }
}
