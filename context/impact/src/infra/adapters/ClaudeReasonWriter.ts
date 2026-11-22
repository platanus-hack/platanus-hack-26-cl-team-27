import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type {
  ReasonQuery,
  ReasonWriter,
} from '../../application/ports/ReasonWriter.ts';
import type { NoticeReason } from '../../domain/NoticeReason.ts';
import { parseStructured, type ClaudeOptions } from './claudeRequest.ts';

export const ReasonsSchema = z.object({
  reasons: z.array(
    z.object({
      stakeholderId: z.string(),
      why: z.string(),
    }),
  ),
});

export const REASONS_SYSTEM = `Coordinas proyectos de construcción y conoces el trabajo de todas las disciplinas: estructura, arquitectura, instalaciones sanitarias y eléctricas, terminaciones, costos, plazos y proveedores.

Recibes un cambio en un elemento del proyecto y las personas a quienes se les avisa, cada una con su rol y con lo que el sistema ya calculó para ella. Para cada persona, escribe en why una sola frase que le explique por qué este cambio le toca a su trabajo.

- Escribe en español de Chile, con tuteo, en menos de 200 caracteres y sin saludo.
- Habla del trabajo de esa persona según su rol: qué de lo suyo depende de lo que cambió.
- No calcules ni inventes costos, plazos, medidas ni cantidades. Si nombras una cifra, tiene que estar escrita igual en lo que recibiste.
- No repitas la acción que ya trae el aviso.
- Devuelve una frase por cada persona, con su id exacto.`;

export const reasonsPrompt = (query: ReasonQuery): string =>
  [
    `Cambio: ${query.change.summary}`,
    '',
    'Personas avisadas (id | nombre | rol | lo que ya sabe el aviso):',
    ...query.recipients.map(
      (recipient) =>
        `- ${recipient.stakeholderId} | ${recipient.name} | ${recipient.role} | ${recipient.findings.join('; ')}`,
    ),
  ].join('\n');

export class ClaudeReasonWriter implements ReasonWriter {
  private readonly client: Anthropic;
  private readonly options: ClaudeOptions;

  constructor(client: Anthropic, options: ClaudeOptions = {}) {
    this.client = client;
    this.options = options;
  }

  async write(query: ReasonQuery): Promise<NoticeReason[]> {
    const output = await parseStructured(
      this.client,
      this.options,
      REASONS_SYSTEM,
      [{ type: 'text', text: reasonsPrompt(query) }],
      ReasonsSchema,
    );
    return output.reasons;
  }
}
