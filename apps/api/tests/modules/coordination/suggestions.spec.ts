import { SuggestAffected } from '@team27/context-impact';
import { FixtureAffectedEstimator } from '@team27/context-impact/adapters';
import type { Change } from '@team27/context-lake';

import { chooseAffectedEstimator } from '../../../src/modules/impact/affected-estimator.ts';
import { buildVocabulary } from '../../../src/modules/impact/vocabulary.ts';
import {
  suggestForChange,
  summariesOf,
} from '../../../src/modules/coordination/suggestions.ts';
import { project } from '../../project.ts';

const vocabulary = buildVocabulary(project);

const change: Change = {
  id: '00000000-0000-4000-8000-000000000001',
  detectedAt: new Date('2026-11-22T12:00:00Z'),
  sourceId: 'rev-1',
  element: { id: 'losa-n3', name: 'Losa nivel 3', category: 'losa' },
  kind: 'modified',
  summary: 'Espesor 15 → 20 cm',
  diffs: [
    { key: 'espesor_cm', label: 'Espesor', unit: 'cm', before: 15, after: 20 },
    { key: 'no_existe', label: 'Otro', unit: null, before: 1, after: 2 },
  ],
  before: { espesor_cm: 15 },
  after: { espesor_cm: 20 },
};

const estimate = (stakeholderId: string, probability: number) => ({
  stakeholderId,
  probability,
  reason: 'Su trabajo depende de la losa',
  evidence: 'sin evidencia directa',
  question: '¿Te afecta?',
});

describe('sugerir afectados de un cambio', () => {
  it('solo consulta por los atributos del vocabulario', () => {
    expect(summariesOf(change, vocabulary).map((s) => s.attribute)).toEqual([
      'espesor_cm',
    ]);
  });

  it('separa a quién preguntar y a quién vigilar, sin la autora ni los avisados', async () => {
    const suggest = new SuggestAffected(
      new FixtureAffectedEstimator([
        {
          subjectId: 'losa-n3',
          attribute: 'espesor_cm',
          estimates: [
            estimate('fernanda-lagos', 0.9),
            estimate('paula-rojas', 0.8),
            estimate('marcos-fuentes', 0.7),
            estimate('daniela-soto', 0.2),
          ],
        },
      ]),
    );

    const split = await suggestForChange(suggest, {
      change,
      vocabulary,
      notifiedIds: ['paula-rojas'],
      authorId: 'fernanda-lagos',
    });

    expect(split.ask.map((item) => item.stakeholderId)).toEqual([
      'marcos-fuentes',
    ]);
    expect(split.watch.map((item) => item.stakeholderId)).toEqual([
      'daniela-soto',
    ]);
  });

  it('sin claves responde 503', async () => {
    const suggest = new SuggestAffected(
      chooseAffectedEstimator(undefined).estimator,
    );
    await expect(
      suggestForChange(suggest, {
        change,
        vocabulary,
        notifiedIds: [],
        authorId: null,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('elige Gemini sin clave de Claude', () => {
    expect(chooseAffectedEstimator('', { apiKey: 'AIza-x' }).mode).toBe(
      'gemini',
    );
  });
});
