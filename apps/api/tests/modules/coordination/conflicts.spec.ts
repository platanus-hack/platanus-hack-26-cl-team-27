import {
  type ConflictEstimator,
  DetectConflicts,
} from '@team27/context-impact';
import type { Change } from '@team27/context-lake';

import { chooseConflictEstimator } from '../../../src/modules/impact/conflict-estimator.ts';
import { buildVocabulary } from '../../../src/modules/impact/vocabulary.ts';
import {
  briefOf,
  comparableChanges,
  detectForChange,
} from '../../../src/modules/coordination/conflicts.ts';
import { project } from '../../project.ts';

const vocabulary = buildVocabulary(project);

const changeOf = (id: string, element: string, name: string): Change => ({
  id,
  detectedAt: new Date('2026-11-22T12:00:00Z'),
  sourceId: 'rev-1',
  element: { id: element, name, category: 'elemento' },
  kind: 'modified',
  summary: `${name} cambia`,
  diffs: [
    { key: 'pos_m', label: 'Posición', unit: 'm', before: 6, after: 8.5 },
  ],
  before: { pos_m: 6 },
  after: { pos_m: 8.5 },
});

const shaft = changeOf(
  '00000000-0000-4000-8000-000000000001',
  'shaft-s1',
  'Shaft S1',
);
const colector = changeOf(
  '00000000-0000-4000-8000-000000000002',
  'colector-b2',
  'Colector B2',
);
const ventana = changeOf(
  '00000000-0000-4000-8000-000000000003',
  'ventanas-n',
  'Ventanas norte',
);

describe('detectar choques de un cambio con otros', () => {
  it('separa los choques probables de los que solo hay que vigilar, sin el propio cambio', async () => {
    const seen: string[][] = [];
    const estimator: ConflictEstimator = {
      estimate: (query) => {
        seen.push(query.others.map((other) => other.id));
        return Promise.resolve([
          {
            otherChangeId: colector.id,
            probability: 0.85,
            reason: 'Ambos en C-D/3',
            question: '¿Se tocan?',
          },
          {
            otherChangeId: ventana.id,
            probability: 0.1,
            reason: 'Fachada distinta',
            question: '¿Se tocan?',
          },
          {
            otherChangeId: 'inventado',
            probability: 0.9,
            reason: 'x',
            question: 'y',
          },
        ]);
      },
    };

    const result = await detectForChange(new DetectConflicts(estimator), {
      change: shaft,
      others: [shaft, colector, ventana],
      vocabulary,
    });

    expect(seen).toEqual([[colector.id, ventana.id]]);
    expect(result.inference).toBe('ok');
    expect(result.conflicts.map((item) => item.otherChangeId)).toEqual([
      colector.id,
    ]);
    expect(result.conflicts[0]?.band).toBe('alta');
    expect(result.watch.map((item) => item.otherChangeId)).toEqual([
      ventana.id,
    ]);
  });

  it('sin claves no falla: dice que la inferencia no está disponible', async () => {
    const result = await detectForChange(
      new DetectConflicts(chooseConflictEstimator(undefined).estimator),
      { change: shaft, others: [colector], vocabulary },
    );
    expect(result).toMatchObject({
      conflicts: [],
      watch: [],
      inference: 'unavailable',
    });
  });

  it('resume el cambio con sus valores', () => {
    expect(briefOf(shaft).summary).toBe(
      'Shaft S1 (modified) · Posición: 6 → 8.5 m',
    );
  });

  it('elige Gemini sin clave de Claude', () => {
    expect(chooseConflictEstimator('', { apiKey: 'AIza-x' }).mode).toBe(
      'gemini',
    );
  });
});

describe('con qué cambios se compara', () => {
  it('no compara con la revisión que fue reemplazada ni con una propuesta retirada', () => {
    expect(
      comparableChanges(
        [shaft, colector, ventana],
        [
          { status: 'superseded', changeIds: [shaft.id] },
          { status: 'withdrawn', changeIds: [ventana.id] },
          { status: 'open', changeIds: [colector.id] },
        ],
      ),
    ).toEqual([colector]);
  });

  it('un cambio sin propuesta sigue contando', () => {
    expect(comparableChanges([shaft], [])).toEqual([shaft]);
  });
});
