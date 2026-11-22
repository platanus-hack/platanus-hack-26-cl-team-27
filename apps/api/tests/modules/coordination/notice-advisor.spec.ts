import {
  modelName,
  suggestedBy,
  suggestionFindings,
  withinTime,
} from '../../../src/modules/coordination/notice-advisor.ts';

const suggestion = {
  stakeholderId: 'paula-rojas',
  probability: 0.81,
  band: 'alta' as const,
  reason: 'Las vigas del nivel 2 reciben la losa.',
  evidence: 'Plano E-201',
  question: '¿Revisas las vigas del nivel 2?',
};

describe('NoticeAdvisor', () => {
  it('nombra al modelo que contesta: Claude si hay clave, si no Gemini', () => {
    expect(modelName('sk-ant')).toBe('Claude');
    expect(modelName(undefined)).toBe('Gemini');
    expect(modelName(' ')).toBe('Gemini');
  });

  it('convierte cada sugerencia en un hallazgo con la razón, la evidencia y la pregunta', () => {
    expect(suggestionFindings([suggestion], 'Losa nivel 3', 'Gemini')).toEqual([
      {
        stakeholderId: 'paula-rojas',
        topic: 'dependency',
        summary: 'Gemini cree que Losa nivel 3 te afecta',
        details: ['Las vigas del nivel 2 reciben la losa.', 'Plano E-201'],
        action: '¿Revisas las vigas del nivel 2?',
      },
    ]);
    expect(suggestedBy([suggestion], 'Gemini')).toEqual({
      'paula-rojas': {
        probability: 0.81,
        reason: 'Las vigas del nivel 2 reciben la losa.',
        evidence: 'Plano E-201',
        model: 'Gemini',
      },
    });
  });

  it('si el modelo falla o tarda, sigue con lo de reserva', async () => {
    await expect(
      withinTime(Promise.reject(new Error('caído')), 1_000, 'reserva'),
    ).resolves.toBe('reserva');
    await expect(
      withinTime(new Promise<string>(() => undefined), 10, 'reserva'),
    ).resolves.toBe('reserva');
    await expect(withinTime(Promise.resolve('ok'), 1_000, 'x')).resolves.toBe(
      'ok',
    );
  });
});
