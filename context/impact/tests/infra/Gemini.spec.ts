import { InferenceUnavailableError } from '../../src/application/errors.ts';
import type { TextEvidence } from '../../src/domain/Evidence.ts';
import { GeminiClaimReader } from '../../src/infra/adapters/GeminiClaimReader.ts';
import { vocabulary } from '../support.ts';

const message: TextEvidence = {
  kind: 'text',
  source: 'mensaje',
  title: 'WhatsApp 14:02',
  text: 'Las ventanas del norte quedaron en 150',
};

const claim = {
  subject: 'ventanas-norte',
  attribute: 'ancho_cm',
  value: 150,
  unit: 'cm',
  role: 'afirma',
  locator: 'quedaron en 150',
  confidence: 0.6,
};

const replying = (body: unknown, status = 200) =>
  vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

const geminiBody = (text: string, finishReason = 'STOP') => ({
  candidates: [{ finishReason, content: { parts: [{ text }] } }],
});

describe('GeminiClaimReader', () => {
  it('pide JSON con el esquema de afirmaciones y devuelve las afirmaciones', async () => {
    const fetch = replying(geminiBody(JSON.stringify({ claims: [claim] })));
    const reader = new GeminiClaimReader({ apiKey: 'k', fetch });

    const claims = await reader.read({ evidence: message, vocabulary });

    expect(claims).toEqual([claim]);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('gemini-3.8-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(
      'k',
    );
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(
      body.generationConfig.responseJsonSchema.properties.claims,
    ).toBeDefined();
    expect(body.contents[0].parts[0].text).toContain('WhatsApp 14:02');
  });

  it('avisa que no hay inferencia si Gemini responde un error', async () => {
    const reader = new GeminiClaimReader({
      apiKey: 'k',
      fetch: replying({ error: {} }, 429),
    });
    await expect(
      reader.read({ evidence: message, vocabulary }),
    ).rejects.toBeInstanceOf(InferenceUnavailableError);
  });

  it('avisa que no hay inferencia si la respuesta no cumple el formato', async () => {
    const reader = new GeminiClaimReader({
      apiKey: 'k',
      fetch: replying(geminiBody('no es json')),
    });
    await expect(
      reader.read({ evidence: message, vocabulary }),
    ).rejects.toThrow('no cumple el formato');
  });
});
