import { APIConnectionError, type TypeSafeClient } from '@typesafe-ai/sdk';
import { InferenceUnavailableError } from '../../src/application/errors.ts';
import type { TextEvidence } from '../../src/domain/Evidence.ts';
import {
  CachedDependencyScorer,
  MemoryResponseCache,
} from '../../src/infra/adapters/Cached.ts';
import { FixtureDependencyScorer } from '../../src/infra/adapters/Fixtures.ts';
import { JevDependencyScorer } from '../../src/infra/adapters/JevDependencyScorer.ts';
import { slabChange, vocabulary } from '../support.ts';

const message: TextEvidence = {
  kind: 'text',
  source: 'mensaje',
  title: 'WhatsApp 09:10',
  text: 'Ojo que en la N3 van los ductos de alumbrado embutidos',
};

const query = {
  change: slabChange,
  vocabulary,
  candidates: vocabulary.stakeholders.filter((s) =>
    ['camila', 'tomas'].includes(s.id),
  ),
  evidence: [
    message,
    {
      kind: 'file' as const,
      source: 'plano' as const,
      title: 'E-102 rev C',
      mediaType: 'application/pdf' as const,
      data: 'JVBERi0x',
    },
  ],
};

const fakeClient = (answers: Record<string, unknown>) => {
  const systemOne = vi.fn(() =>
    Promise.resolve({
      model: 'jev-1.14.0',
      answers,
      usage: { input_tokens: 300, output_tokens: 8 },
    }),
  );
  return {
    client: { systemOne } as unknown as TypeSafeClient,
    systemOne,
  };
};

type JevRequest = {
  model: string;
  state: Record<string, unknown>;
  questions: Record<
    string,
    { type: string; instructions: string; criteria: unknown }
  >;
};

describe('JevDependencyScorer', () => {
  it('hace una pregunta noul por candidato y devuelve su probabilidad', async () => {
    const { client, systemOne } = fakeClient({
      p0: { type: 'noul', noul: 0.72 },
      p1: { type: 'noul', noul: 0.08 },
    });

    const result = await new JevDependencyScorer(client).score(query);

    expect(result).toEqual([
      { stakeholderId: 'camila', probability: 0.72 },
      { stakeholderId: 'tomas', probability: 0.08 },
    ]);
    const request = (systemOne.mock.calls[0] as unknown[])[0] as JevRequest;
    expect(request.model).toBe('jev-latest');
    expect(Object.keys(request.questions)).toEqual(['p0', 'p1']);
    expect(request.questions.p0?.type).toBe('noul');
    expect(request.questions.p0?.instructions).toContain(
      'Camila Vera (Instalaciones eléctricas)',
    );
    expect(request.questions.p0?.criteria).toHaveProperty('true');
  });

  it('manda el cambio y solo la evidencia de texto en el estado', async () => {
    const { client, systemOne } = fakeClient({
      p0: { type: 'noul', noul: 0.5 },
      p1: { type: 'noul', noul: 0.5 },
    });

    await new JevDependencyScorer(client, { model: 'jev-1.14.0' }).score(query);

    const request = (systemOne.mock.calls[0] as unknown[])[0] as JevRequest;
    expect(request.model).toBe('jev-1.14.0');
    expect(request.state).toEqual({
      proyecto: 'Edificio Los Aromos',
      cambio: {
        elemento: 'Losa nivel 3',
        atributo: 'Espesor',
        antes: 15,
        despues: 20,
        unidad: 'cm',
        resumen: 'Espesor: 15 cm → 20 cm',
      },
      evidencia: [
        {
          titulo: 'WhatsApp 09:10',
          fuente: 'mensaje',
          texto: 'Ojo que en la N3 van los ductos de alumbrado embutidos',
        },
      ],
    });
  });

  it('omite a quien no tiene respuesta y no llama sin candidatos', async () => {
    const { client, systemOne } = fakeClient({
      p0: { type: 'noul', noul: 0.4 },
    });
    const scorer = new JevDependencyScorer(client);

    expect(await scorer.score(query)).toEqual([
      { stakeholderId: 'camila', probability: 0.4 },
    ]);
    expect(await scorer.score({ ...query, candidates: [] })).toEqual([]);
    expect(systemOne).toHaveBeenCalledTimes(1);
  });

  it('traduce los errores del SDK a no disponible', async () => {
    const systemOne = vi.fn(() =>
      Promise.reject(new APIConnectionError('sin red')),
    );
    const client = { systemOne } as unknown as TypeSafeClient;

    await expect(new JevDependencyScorer(client).score(query)).rejects.toThrow(
      InferenceUnavailableError,
    );
  });
});

describe('FixtureDependencyScorer y CachedDependencyScorer', () => {
  it('reproducen los puntajes del guion y los guardan por consulta', async () => {
    const fixture = new FixtureDependencyScorer([
      {
        subjectId: 'losa-n3',
        attribute: 'espesor_cm',
        scores: [{ stakeholderId: 'camila', probability: 0.72 }],
      },
    ]);
    const spy = vi.spyOn(fixture, 'score');
    const cached = new CachedDependencyScorer(
      fixture,
      new MemoryResponseCache(),
      'jev-latest',
    );

    expect(await cached.score(query)).toEqual([
      { stakeholderId: 'camila', probability: 0.72 },
    ]);
    await cached.score(query);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(
      await fixture.score({
        ...query,
        change: { ...slabChange, attribute: 'otro' },
      }),
    ).toEqual([]);
  });
});
