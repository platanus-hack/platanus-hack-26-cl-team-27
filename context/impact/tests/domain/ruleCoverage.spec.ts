import type { ChangeUnderAnalysis } from '../../src/domain/analyzeChange.ts';
import { ruleCoverage, ruleGapMessage } from '../../src/domain/ruleCoverage.ts';
import { GRAPH } from '../graph.ts';

const slab: ChangeUnderAnalysis = {
  id: 'c1',
  elementId: 'losa-n3',
  elementName: 'Losa nivel 3',
  category: 'losa',
  changedKeys: ['espesor_cm', 'terminacion'],
  before: { espesor_cm: 15, area_m2: 280, terminacion: 'afinado' },
  after: { espesor_cm: 20, area_m2: 280, terminacion: 'pulido' },
};

const shaft: ChangeUnderAnalysis = {
  id: 'c4',
  elementId: 'shaft-s1',
  elementName: 'Shaft S1',
  category: 'shaft',
  changedKeys: ['ancho_cm', 'posicion_m'],
  before: { ancho_cm: 60, largo_cm: 120, posicion_m: 6 },
  after: { ancho_cm: 80, largo_cm: 120, posicion_m: 8.5 },
};

describe('ruleCoverage', () => {
  it('un atributo que mueve una partida y una tarea tiene las dos reglas', () => {
    expect(ruleCoverage(slab, GRAPH)[0]).toEqual({
      key: 'espesor_cm',
      cost: true,
      schedule: true,
    });
  });

  it('un atributo que ninguna cantidad usa no tiene reglas', () => {
    expect(ruleCoverage(slab, GRAPH)[1]).toEqual({
      key: 'terminacion',
      cost: false,
      schedule: false,
    });
  });

  it('un tipo de elemento sin partidas ni tareas no tiene reglas', () => {
    expect(ruleCoverage(shaft, GRAPH)).toEqual([
      { key: 'ancho_cm', cost: false, schedule: false },
      { key: 'posicion_m', cost: false, schedule: false },
    ]);
  });

  it('un elemento nuevo cuenta con las reglas de sus atributos', () => {
    const added = { ...slab, changedKeys: ['espesor_cm'], before: {} };

    expect(ruleCoverage(added, GRAPH)).toEqual([
      { key: 'espesor_cm', cost: true, schedule: true },
    ]);
  });

  it('una partida sin tarea deja solo el plazo sin regla', () => {
    const graph = { ...GRAPH, tasks: [] };

    expect(ruleCoverage(slab, graph)[0]).toEqual({
      key: 'espesor_cm',
      cost: true,
      schedule: false,
    });
  });
});

describe('ruleGapMessage', () => {
  it('no dice nada si hay reglas de costo y de plazo', () => {
    expect(
      ruleGapMessage({ key: 'espesor_cm', cost: true, schedule: true }, 'x'),
    ).toBeNull();
  });

  it('dice qué regla falta, con el nombre del atributo', () => {
    expect(
      ruleGapMessage(
        { key: 'ancho_cm', cost: false, schedule: false },
        'Ancho del shaft',
      ),
    ).toBe('No hay reglas de costo ni de plazo para Ancho del shaft.');
    expect(
      ruleGapMessage(
        { key: 'ancho_cm', cost: false, schedule: true },
        'Ancho del shaft',
      ),
    ).toBe('No hay reglas de costo para Ancho del shaft.');
    expect(
      ruleGapMessage(
        { key: 'ancho_cm', cost: true, schedule: false },
        'Ancho del shaft',
      ),
    ).toBe('No hay reglas de plazo para Ancho del shaft.');
  });
});
