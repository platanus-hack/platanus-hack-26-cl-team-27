import type { AffectedEstimate } from '../../src/domain/AffectedSuggestion.ts';
import {
  NO_EVIDENCE,
  screenScores,
  templateQuestion,
  UNWRITTEN_REASON,
  withScores,
} from '../../src/domain/DependencyScore.ts';
import { slabChange, vocabulary } from '../support.ts';

describe('screenScores', () => {
  it('deja solo candidatos con probabilidad válida, acotada y la más alta por persona', () => {
    const result = screenScores(
      [
        { stakeholderId: 'camila', probability: 0.61 },
        { stakeholderId: 'camila', probability: 0.724 },
        { stakeholderId: 'tomas', probability: Number.NaN },
        { stakeholderId: 'paula', probability: 0.9 },
        { stakeholderId: 'tomas', probability: -1 },
      ],
      new Set(['camila', 'tomas']),
    );

    expect(result).toEqual([
      { stakeholderId: 'camila', probability: 0.72 },
      { stakeholderId: 'tomas', probability: 0 },
    ]);
  });
});

describe('templateQuestion', () => {
  it('arma una pregunta de sí o no con el atributo, el elemento y los valores', () => {
    expect(templateQuestion(slabChange, vocabulary)).toBe(
      '¿Te afecta el cambio de «Espesor» en «Losa nivel 3», de 15 cm a 20 cm?',
    );
  });

  it('usa coma decimal y cae al resumen si el atributo no está en el vocabulario', () => {
    expect(
      templateQuestion(
        {
          ...slabChange,
          subjectId: 'shaft-s1',
          attribute: 'posicion_m',
          before: 6,
          after: 8.5,
          unit: 'm',
          summary: 'Posición: 6 m → 8,5 m',
        },
        vocabulary,
      ),
    ).toBe('¿Te afecta el cambio de «Posición: 6 m → 8,5 m», de 6 m a 8,5 m?');
  });
});

describe('withScores', () => {
  const written: AffectedEstimate = {
    stakeholderId: 'camila',
    probability: 0.2,
    reason: 'Ductos embutidos en la losa',
    evidence: 'E-102 rev C, eje B',
    question: '¿Tus canalizaciones van embutidas en la losa N3?',
  };

  it('toma la probabilidad del puntaje y el texto de quien lo escribió', () => {
    const [result] = withScores(
      [{ stakeholderId: 'camila', probability: 0.72 }],
      [written],
      'plantilla',
    );

    expect(result).toEqual({ ...written, probability: 0.72 });
  });

  it('sin texto escrito, usa la razón genérica y la pregunta de plantilla', () => {
    const [result] = withScores(
      [{ stakeholderId: 'tomas', probability: 0.3 }],
      [written, { ...written, stakeholderId: 'tomas', question: ' ' }],
      'plantilla',
    );

    expect(result).toEqual({
      stakeholderId: 'tomas',
      probability: 0.3,
      reason: UNWRITTEN_REASON,
      evidence: NO_EVIDENCE,
      question: 'plantilla',
    });
  });
});
