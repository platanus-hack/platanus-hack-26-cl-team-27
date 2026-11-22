import { InferenceUnavailableError } from '../../src/application/errors.ts';
import { GeminiAffectedEstimator } from '../../src/infra/adapters/GeminiAffectedEstimator.ts';
import { slabChange, vocabulary } from '../support.ts';

const replying = (body: unknown, status = 200) =>
  vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

const geminiBody = (text: string) => ({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
});

const candidates = vocabulary.stakeholders.slice(0, 1);

const estimate = {
  stakeholderId: candidates[0]?.id ?? '',
  probability: 0.8,
  reason: 'Su trabajo cuelga de la losa',
  evidence: 'sin evidencia directa',
  question: '¿Te afecta el cambio de espesor?',
};

describe('GeminiAffectedEstimator', () => {
  it('pide JSON con el esquema de estimaciones y nombra a los candidatos', async () => {
    const fetch = replying(
      geminiBody(JSON.stringify({ estimates: [estimate] })),
    );
    const estimator = new GeminiAffectedEstimator({ apiKey: 'k', fetch });

    const estimates = await estimator.estimate({
      change: slabChange,
      vocabulary,
      candidates,
      evidence: [],
    });

    expect(estimates).toEqual([estimate]);
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(
      body.generationConfig.responseJsonSchema.properties.estimates,
    ).toBeDefined();
    expect(body.contents[0].parts.at(-1).text).toContain(
      estimate.stakeholderId,
    );
  });

  it('avisa que no hay inferencia si la respuesta no cumple el formato', async () => {
    const estimator = new GeminiAffectedEstimator({
      apiKey: 'k',
      fetch: replying(geminiBody('{"otra":1}')),
    });
    await expect(
      estimator.estimate({
        change: slabChange,
        vocabulary,
        candidates,
        evidence: [],
      }),
    ).rejects.toBeInstanceOf(InferenceUnavailableError);
  });
});
