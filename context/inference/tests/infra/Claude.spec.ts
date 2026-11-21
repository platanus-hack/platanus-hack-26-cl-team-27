import Anthropic from '@anthropic-ai/sdk';
import { InferenceUnavailableError } from '../../src/application/errors.ts';
import type { FileEvidence, TextEvidence } from '../../src/domain/Evidence.ts';
import { ClaudeAffectedEstimator } from '../../src/infra/adapters/ClaudeAffectedEstimator.ts';
import { ClaudeClaimReader } from '../../src/infra/adapters/ClaudeClaimReader.ts';
import { slabChange, vocabulary } from '../support.ts';

const fakeClient = (response: unknown) => {
  const parse = vi.fn(() => Promise.resolve(response));
  const client = { beta: { messages: { parse } } } as unknown as Anthropic;
  return { client, parse };
};

const requestOf = (parse: ReturnType<typeof fakeClient>['parse']) =>
  (parse.mock.calls[0] as unknown[] | undefined)?.[0] as {
    model: string;
    betas: string[];
    fallbacks: string;
    output_config: { effort: string; format: unknown };
    system: string;
    messages: { role: string; content: Record<string, unknown>[] }[];
  };

const drawing: FileEvidence = {
  kind: 'file',
  source: 'plano',
  title: 'E-102 rev C',
  mediaType: 'application/pdf',
  data: 'JVBERi0x',
};

const photo: FileEvidence = {
  ...drawing,
  title: 'Foto del cielo N2',
  mediaType: 'image/png',
  data: 'iVBORw0K',
};

const message: TextEvidence = {
  kind: 'text',
  source: 'mensaje',
  title: 'WhatsApp 14:02',
  text: 'Las ventanas del norte quedaron en 150',
};

const affectedQuery = {
  change: slabChange,
  vocabulary,
  candidates: vocabulary.stakeholders.filter((s) => s.id === 'camila'),
  evidence: [drawing],
};

describe('ClaudeAffectedEstimator', () => {
  it('pide salida estructurada a Claude Opus 5.5, con fallback del servidor', async () => {
    const estimates = [
      {
        stakeholderId: 'camila',
        probability: 0.72,
        reason: 'Ductos embutidos en la losa',
        evidence: 'E-102 rev C, eje B',
        question: '¿Tus canalizaciones van embutidas en la losa N3?',
      },
    ];
    const { client, parse } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: { estimates },
    });

    const result = await new ClaudeAffectedEstimator(client).estimate(
      affectedQuery,
    );

    expect(result).toEqual(estimates);
    const request = requestOf(parse);
    expect(request.model).toBe('claude-opus-5-5');
    expect(request.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(request.fallbacks).toBe('default');
    expect(request.output_config.effort).toBe('medium');
    expect(request.output_config.format).toBeDefined();
  });

  it('manda el plano como documento PDF antes del texto, con el cambio y los candidatos', async () => {
    const { client, parse } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: { estimates: [] },
    });

    await new ClaudeAffectedEstimator(client, { effort: 'high' }).estimate(
      affectedQuery,
    );

    const request = requestOf(parse);
    const content = request.messages[0]?.content ?? [];
    expect(content[0]).toMatchObject({
      type: 'document',
      title: 'E-102 rev C',
      source: { type: 'base64', media_type: 'application/pdf' },
    });
    const prompt = String(content.at(-1)?.text);
    expect(prompt).toContain('losa-n3.espesor_cm: 15 cm → 20 cm');
    expect(prompt).toContain(
      '- camila | Camila Vera | Instalaciones eléctricas',
    );
    expect(prompt).not.toContain('paula |');
    expect(request.output_config.effort).toBe('high');
  });

  it('avisa como no disponible si el modelo declina, corta o no cumple el formato', async () => {
    for (const response of [
      { stop_reason: 'refusal', parsed_output: null },
      { stop_reason: 'max_tokens', parsed_output: null },
      { stop_reason: 'end_turn', parsed_output: null },
    ]) {
      const { client } = fakeClient(response);
      await expect(
        new ClaudeAffectedEstimator(client).estimate(affectedQuery),
      ).rejects.toThrow(InferenceUnavailableError);
    }
  });

  it('traduce los errores de la API', async () => {
    const parse = vi.fn(() =>
      Promise.reject(new Anthropic.APIConnectionError({ message: 'sin red' })),
    );
    const client = { beta: { messages: { parse } } } as unknown as Anthropic;

    await expect(
      new ClaudeAffectedEstimator(client).estimate(affectedQuery),
    ).rejects.toThrow(InferenceUnavailableError);
  });
});

describe('ClaudeClaimReader', () => {
  it('lee una imagen como bloque de imagen y devuelve las afirmaciones', async () => {
    const claims = [
      {
        subject: 'ventanas-norte',
        attribute: 'ancho_cm',
        value: 150,
        unit: 'cm',
        role: 'afirma',
        locator: 'cota sobre vano',
        confidence: 0.8,
      },
    ];
    const { client, parse } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: { claims },
    });

    const result = await new ClaudeClaimReader(client).read({
      evidence: photo,
      vocabulary,
    });

    expect(result).toEqual(claims);
    const content = requestOf(parse).messages[0]?.content ?? [];
    expect(content[0]).toMatchObject({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0K' },
    });
  });

  it('manda los mensajes como texto con su título y el vocabulario', async () => {
    const { client, parse } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: { claims: [] },
    });

    await new ClaudeClaimReader(client).read({ evidence: message, vocabulary });

    const content = requestOf(parse).messages[0]?.content ?? [];
    expect(content[0]).toEqual({
      type: 'text',
      text: '«WhatsApp 14:02» (mensaje):\nLas ventanas del norte quedaron en 150',
    });
    expect(String(content[1]?.text)).toContain(
      '- ventanas-norte.ancho_cm [cm]: Ventanas fachada norte, Ancho',
    );
  });
});
