import {
  analyzeChange,
  type ChangeUnderAnalysis,
} from '../../src/domain/analyzeChange.ts';
import { combineImpacts } from '../../src/domain/combineImpacts.ts';
import type { Impact } from '../../src/domain/Impact.ts';
import { GRAPH } from '../graph.ts';

const slab: ChangeUnderAnalysis = {
  id: 'c1',
  elementId: 'losa-n3',
  elementName: 'Losa nivel 3',
  category: 'losa',
  changedKeys: ['espesor_cm'],
  before: { espesor_cm: 15, area_m2: 280 },
  after: { espesor_cm: 20, area_m2: 280 },
};

const windows: ChangeUnderAnalysis = {
  id: 'c2',
  elementId: 'ventanas-norte',
  elementName: 'Ventanas fachada norte',
  category: 'ventana',
  changedKeys: ['ancho_cm'],
  before: { cantidad: 24, ancho_cm: 120, alto_cm: 150 },
  after: { cantidad: 24, ancho_cm: 150, alto_cm: 150 },
};

const walls: Impact = {
  changeId: 'c3',
  costDelta: 500_000,
  delayDays: 2,
  projectDaysBefore: 29,
  projectDaysAfter: 31,
  costLines: [
    {
      code: '03.02',
      name: 'Hormigón H30 en losas',
      unit: 'm³',
      unitPrice: 145_000,
      before: 10,
      after: 12,
      delta: 290_000,
    },
  ],
  tasks: [
    {
      id: 'muros',
      name: 'Muros nivel 3',
      daysBefore: 6,
      daysAfter: 8,
      floatDays: 0,
      critical: true,
    },
  ],
  findings: [],
  filtered: [],
};

describe('combineImpacts', () => {
  it('suma el costo de los dos cambios y recalcula la entrega con las tareas de ambos', () => {
    const combined = combineImpacts(
      [analyzeChange(slab, GRAPH), analyzeChange(windows, GRAPH)],
      GRAPH.tasks,
    );

    expect(combined).toMatchObject({
      changeIds: ['c1', 'c2'],
      costDelta: 3_636_500 + 1_998_000,
      delayDays: 1,
      projectDaysBefore: 29,
      projectDaysAfter: 30,
    });
    expect(combined.costLines.map((line) => line.code)).toEqual([
      '03.02',
      '03.03',
      '07.01',
    ]);
    expect(
      combined.tasks.map((task) => [task.id, task.critical, task.floatDays]),
    ).toEqual([
      ['losa', true, 0],
      ['ventanas', false, 5],
    ]);
  });

  it('dos atrasos en la misma cadena crítica se acumulan', () => {
    const combined = combineImpacts(
      [analyzeChange(slab, GRAPH), walls],
      GRAPH.tasks,
    );

    expect(combined.delayDays).toBe(3);
    expect(combined.projectDaysAfter).toBe(32);
    expect(combined.costDelta).toBe(3_636_500 + 500_000);
    expect(combined.costLines.find((line) => line.code === '03.02')).toEqual(
      expect.objectContaining({ before: 52, after: 68, delta: 2_320_000 }),
    );
  });

  it('el mismo cambio dos veces cuenta una sola vez', () => {
    const impact = analyzeChange(slab, GRAPH);
    const combined = combineImpacts([impact, impact], GRAPH.tasks);

    expect(combined.changeIds).toEqual(['c1']);
    expect(combined.costDelta).toBe(impact.costDelta);
    expect(combined.delayDays).toBe(impact.delayDays);
  });

  it('sin impactos no hay costo ni atraso', () => {
    expect(combineImpacts([], GRAPH.tasks)).toMatchObject({
      changeIds: [],
      costDelta: 0,
      delayDays: 0,
      costLines: [],
      tasks: [],
    });
  });
});
