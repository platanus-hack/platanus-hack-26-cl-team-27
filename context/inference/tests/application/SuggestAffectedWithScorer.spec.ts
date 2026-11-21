import {
  InferenceUnavailableError,
  ValidationError,
} from '../../src/application/errors.ts';
import type { AffectedEstimator } from '../../src/application/ports/AffectedEstimator.ts';
import type { DependencyScorer } from '../../src/application/ports/DependencyScorer.ts';
import { SuggestAffected } from '../../src/application/use-cases/SuggestAffected.ts';
import type { AffectedEstimate } from '../../src/domain/AffectedSuggestion.ts';
import type { DependencyScore } from '../../src/domain/DependencyScore.ts';
import { UNWRITTEN_REASON } from '../../src/domain/DependencyScore.ts';
import { slabChange, vocabulary } from '../support.ts';

const camilaText: AffectedEstimate = {
  stakeholderId: 'camila',
  probability: 0.1,
  reason: 'Ductos embutidos en la losa',
  evidence: 'E-102 rev C, eje B',
  question: '¿Tus canalizaciones van embutidas en la losa N3?',
};

const setup = (
  scores: DependencyScore[],
  write: () => Promise<AffectedEstimate[]> = () =>
    Promise.resolve([camilaText]),
) => {
  const scorer = {
    score: vi.fn<DependencyScorer['score']>(() => Promise.resolve(scores)),
  };
  const estimator = { estimate: vi.fn<AffectedEstimator['estimate']>(write) };
  return {
    scorer,
    estimator,
    useCase: new SuggestAffected(estimator, scorer),
  };
};

const input = {
  change: slabChange,
  vocabulary,
  notifiedIds: ['paula'],
  authorId: 'fernanda',
  evidence: [],
};

describe('SuggestAffected con un modelo de decisión', () => {
  it('puntúa a todos y solo pide texto para quienes pasan el umbral', async () => {
    const { scorer, estimator, useCase } = setup([
      { stakeholderId: 'camila', probability: 0.72 },
      { stakeholderId: 'tomas', probability: 0.2 },
    ]);

    const result = await useCase.execute(input);

    expect(scorer.score.mock.calls[0]?.[0].candidates.map((c) => c.id)).toEqual(
      ['camila', 'tomas'],
    );
    expect(
      estimator.estimate.mock.calls[0]?.[0].candidates.map((c) => c.id),
    ).toEqual(['camila']);
    expect(result.ask).toEqual([
      { ...camilaText, probability: 0.72, band: 'alta' },
    ]);
    expect(result.watch).toEqual([
      {
        stakeholderId: 'tomas',
        probability: 0.2,
        reason: UNWRITTEN_REASON,
        evidence: 'sin evidencia directa',
        question:
          '¿Te afecta el cambio de «Espesor» en «Losa nivel 3», de 15 cm a 20 cm?',
        band: 'baja',
      },
    ]);
  });

  it('la probabilidad que manda es la del modelo de decisión', async () => {
    const { useCase } = setup([{ stakeholderId: 'camila', probability: 0.55 }]);

    const result = await useCase.execute(input);

    expect(result.ask[0]?.probability).toBe(0.55);
  });

  it('no pide texto si nadie pasa el umbral', async () => {
    const { estimator, useCase } = setup([
      { stakeholderId: 'camila', probability: 0.3 },
    ]);

    const result = await useCase.execute(input);

    expect(estimator.estimate).not.toHaveBeenCalled();
    expect(result.ask).toEqual([]);
    expect(result.watch).toHaveLength(1);
  });

  it('si el redactor no está disponible, pregunta igual con la plantilla', async () => {
    const { useCase } = setup(
      [{ stakeholderId: 'camila', probability: 0.8 }],
      () => Promise.reject(new InferenceUnavailableError('sin red')),
    );

    const result = await useCase.execute(input);

    expect(result.ask).toEqual([
      expect.objectContaining({
        stakeholderId: 'camila',
        probability: 0.8,
        reason: UNWRITTEN_REASON,
      }),
    ]);
  });

  it('no esconde otros errores del redactor', async () => {
    const { useCase } = setup(
      [{ stakeholderId: 'camila', probability: 0.8 }],
      () => Promise.reject(new ValidationError('mal')),
    );

    await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
  });

  it('si el modelo de decisión falla, la consulta falla', async () => {
    const { scorer, useCase } = setup([]);
    scorer.score.mockRejectedValueOnce(new InferenceUnavailableError('caído'));

    await expect(useCase.execute(input)).rejects.toThrow(
      InferenceUnavailableError,
    );
  });
});
