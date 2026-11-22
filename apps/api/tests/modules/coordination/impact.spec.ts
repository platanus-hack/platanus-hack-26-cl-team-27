import type { Impact, ProjectGraph } from '@team27/context-impact';
import type { Change } from '@team27/context-lake';

import {
  combinedImpactOf,
  ruleGapsOf,
} from '../../../src/modules/coordination/impact.ts';

const graph: ProjectGraph = {
  costOwnerId: 'costos',
  scheduleOwnerId: 'obra',
  budgetItems: [
    {
      code: '03.02',
      name: 'Hormigón H30 en losas',
      unit: 'm³',
      unitPrice: 145_000,
      category: 'losa',
      quantity: 'volumen',
      factor: 1,
    },
  ],
  tasks: [
    {
      id: 'base',
      name: 'Fundaciones',
      days: 20,
      predecessors: [],
      driver: null,
    },
    {
      id: 'losa',
      name: 'Hormigonado losa nivel 3',
      days: 3,
      predecessors: ['base'],
      driver: { elementId: 'losa-n3', quantity: 'volumen', productivity: 15 },
    },
  ],
  dependencies: [],
};

const shaft: Change = {
  id: '00000000-0000-4000-8000-000000000001',
  detectedAt: new Date('2026-11-22T12:00:00Z'),
  sourceId: 'rev-1',
  element: { id: 'shaft-s1', name: 'Shaft S1', category: 'shaft' },
  kind: 'modified',
  summary: 'Shaft S1 cambia',
  diffs: [
    {
      key: 'ancho_cm',
      label: 'Ancho del shaft',
      unit: 'cm',
      before: 60,
      after: 80,
    },
  ],
  before: { ancho_cm: 60, largo_cm: 120 },
  after: { ancho_cm: 80, largo_cm: 120 },
};

const slab: Change = {
  ...shaft,
  id: '00000000-0000-4000-8000-000000000002',
  element: { id: 'losa-n3', name: 'Losa nivel 3', category: 'losa' },
  diffs: [
    { key: 'espesor_cm', label: 'Espesor', unit: 'cm', before: 15, after: 20 },
  ],
  before: { espesor_cm: 15, area_m2: 280 },
  after: { espesor_cm: 20, area_m2: 280 },
};

const impactOf = (
  changeId: string,
  costDelta: number,
  days: number,
): Impact => ({
  changeId,
  costDelta,
  delayDays: days,
  projectDaysBefore: 23,
  projectDaysAfter: 23 + days,
  costLines: [],
  tasks:
    days === 0
      ? []
      : [
          {
            id: 'losa',
            name: 'Hormigonado losa nivel 3',
            daysBefore: 3,
            daysAfter: 3 + days,
            floatDays: 0,
            critical: true,
          },
        ],
  findings: [],
  filtered: [],
});

describe('lo que el calculador de impacto dice de un cambio', () => {
  it('avisa con el nombre del atributo cuando no hay reglas', () => {
    expect(ruleGapsOf(shaft, graph)).toEqual([
      {
        key: 'ancho_cm',
        label: 'Ancho del shaft',
        cost: false,
        schedule: false,
        message: 'No hay reglas de costo ni de plazo para Ancho del shaft.',
      },
    ]);
  });

  it('no avisa nada cuando el atributo tiene sus reglas', () => {
    expect(ruleGapsOf(slab, graph)).toEqual([]);
  });

  it('junta el impacto de dos cambios que chocan', () => {
    const impacts = new Map([
      [slab.id, impactOf(slab.id, 2_030_000, 1)],
      [shaft.id, impactOf(shaft.id, 400_000, 2)],
    ]);

    expect(combinedImpactOf(impacts, [slab.id, shaft.id], graph)).toMatchObject(
      {
        changeIds: [slab.id, shaft.id],
        costDelta: 2_430_000,
        delayDays: 3,
        projectDaysBefore: 23,
        projectDaysAfter: 26,
        missingChangeIds: [],
      },
    );
  });

  it('dice qué cambio no tiene impacto calculado', () => {
    const impacts = new Map([[slab.id, impactOf(slab.id, 2_030_000, 1)]]);

    expect(combinedImpactOf(impacts, [slab.id, shaft.id], graph)).toMatchObject(
      {
        costDelta: 2_030_000,
        delayDays: 1,
        missingChangeIds: [shaft.id],
      },
    );
  });

  it('sin otro cambio o sin ningún impacto no hay cifra conjunta', () => {
    const impacts = new Map([[slab.id, impactOf(slab.id, 2_030_000, 1)]]);

    expect(combinedImpactOf(impacts, [slab.id], graph)).toBeNull();
    expect(combinedImpactOf(new Map(), [slab.id, shaft.id], graph)).toBeNull();
  });
});
