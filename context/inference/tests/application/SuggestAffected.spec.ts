import { ValidationError } from '../../src/application/errors.ts';
import type { AffectedEstimator } from '../../src/application/ports/AffectedEstimator.ts';
import { SuggestAffected } from '../../src/application/use-cases/SuggestAffected.ts';
import type { AffectedEstimate } from '../../src/domain/AffectedSuggestion.ts';
import { slabChange, vocabulary } from '../support.ts';

const estimate = (
  stakeholderId: string,
  probability: number,
): AffectedEstimate => ({
  stakeholderId,
  probability,
  reason: 'razón',
  evidence: 'sin evidencia directa',
  question: '¿Te afecta?',
});

const setup = (estimates: AffectedEstimate[] = []) => {
  const estimator = {
    estimate: vi.fn<AffectedEstimator['estimate']>(() =>
      Promise.resolve(estimates),
    ),
  };
  return { estimator, useCase: new SuggestAffected(estimator) };
};

const input = {
  change: slabChange,
  vocabulary,
  notifiedIds: ['paula'],
  authorId: 'fernanda',
  evidence: [],
};

describe('SuggestAffected', () => {
  it('solo consulta por quienes no avisaron las reglas ni son la autora', async () => {
    const { estimator, useCase } = setup();

    await useCase.execute(input);

    const query = estimator.estimate.mock.calls[0]?.[0];
    expect(query?.candidates.map((c) => c.id)).toEqual(['camila', 'tomas']);
    expect(query?.change).toBe(slabChange);
  });

  it('separa a quién preguntar y a quién solo observar, sin colar avisados', async () => {
    const { useCase } = setup([
      estimate('camila', 0.72),
      estimate('tomas', 0.2),
      estimate('paula', 0.99),
    ]);

    const result = await useCase.execute(input);

    expect(result.ask.map((s) => s.stakeholderId)).toEqual(['camila']);
    expect(result.watch.map((s) => s.stakeholderId)).toEqual(['tomas']);
  });

  it('respeta el umbral que le pasan', async () => {
    const { useCase } = setup([estimate('camila', 0.72)]);

    const result = await useCase.execute({ ...input, threshold: 0.8 });

    expect(result.ask).toEqual([]);
    expect(result.watch).toHaveLength(1);
  });

  it('no llama al modelo si no queda nadie por evaluar', async () => {
    const { estimator, useCase } = setup();

    const result = await useCase.execute({
      ...input,
      notifiedIds: ['paula', 'camila', 'tomas'],
    });

    expect(result).toEqual({ ask: [], watch: [] });
    expect(estimator.estimate).not.toHaveBeenCalled();
  });

  it('rechaza un cambio fuera del vocabulario y un umbral inválido', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        ...input,
        change: { ...slabChange, attribute: 'color' },
      }),
    ).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ ...input, threshold: 0 })).rejects.toThrow(
      'El umbral debe estar entre 0 y 1',
    );
  });
});
