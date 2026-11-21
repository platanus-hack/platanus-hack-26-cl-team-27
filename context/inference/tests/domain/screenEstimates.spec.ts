import {
  screenEstimates,
  splitByThreshold,
  type AffectedEstimate,
} from '../../src/domain/AffectedSuggestion.ts';

const estimate = (
  stakeholderId: string,
  probability: number,
  overrides: Partial<AffectedEstimate> = {},
): AffectedEstimate => ({
  stakeholderId,
  probability,
  reason: 'Sus canalizaciones van embutidas en la losa',
  evidence: 'E-102 rev C, cajetín',
  question: '¿Tus canalizaciones cruzan la losa N3?',
  ...overrides,
});

describe('screenEstimates', () => {
  const candidates = new Set(['camila', 'tomas']);

  it('descarta a quien no es candidato y lo que viene sin razón o sin pregunta', () => {
    const result = screenEstimates(
      [
        estimate('paula', 0.9),
        estimate('camila', 0.8, { reason: '  ' }),
        estimate('tomas', 0.6, { question: '' }),
      ],
      candidates,
    );

    expect(result).toEqual([]);
  });

  it('acota la probabilidad entre 0 y 1, con dos decimales, y le pone banda', () => {
    const result = screenEstimates(
      [estimate('camila', 1.4), estimate('tomas', 0.4567)],
      candidates,
    );

    expect(result.map((s) => [s.stakeholderId, s.probability, s.band])).toEqual(
      [
        ['camila', 1, 'alta'],
        ['tomas', 0.46, 'media'],
      ],
    );
  });

  it('deja la estimación más alta por persona y ordena de mayor a menor', () => {
    const result = screenEstimates(
      [
        estimate('tomas', 0.2),
        estimate('camila', 0.5),
        estimate('camila', 0.72, { reason: ' Ductos embutidos ' }),
      ],
      candidates,
    );

    expect(result.map((s) => s.stakeholderId)).toEqual(['camila', 'tomas']);
    expect(result[0]).toMatchObject({
      probability: 0.72,
      reason: 'Ductos embutidos',
      band: 'alta',
    });
    expect(result[1]?.band).toBe('baja');
  });

  it('ignora probabilidades que no son números', () => {
    expect(
      screenEstimates([estimate('camila', Number.NaN)], candidates),
    ).toEqual([]);
  });
});

describe('splitByThreshold', () => {
  it('pregunta desde el umbral y deja el resto en observación', () => {
    const suggestions = screenEstimates(
      [estimate('camila', 0.5), estimate('tomas', 0.49)],
      new Set(['camila', 'tomas']),
    );

    const { ask, watch } = splitByThreshold(suggestions, 0.5);

    expect(ask.map((s) => s.stakeholderId)).toEqual(['camila']);
    expect(watch.map((s) => s.stakeholderId)).toEqual(['tomas']);
  });
});
