import { describe, expect, it } from 'vitest';

import type { ViewerModel } from './aps-api';
import {
  axesRotatedBy,
  deltaToViewerUnits,
  easeInOut,
  matchesMark,
  metersPerUnit,
  planScene,
  rotateDelta,
  selectCaseModels,
  shiftBox,
  toWorldMeters,
  unionBoxes,
  type CaseFlowState,
} from './aps-viewer-flow';

const change = { elementId: 'P-12', delta: { dx: 0, dy: 0.4, dz: 0 } };
const proposal = (
  status: 'propuesta' | 'aplicada' | 'resuelta' | 'rechazada',
) =>
  ({
    elementId: 'E-B-03',
    delta: { dx: 0, dy: 0.4, dz: 0 },
    status,
  }) as const;

describe('unidades', () => {
  it('prefiere la escala del modelo y si no lee el texto de la unidad', () => {
    expect(metersPerUnit('ft', 0.3048)).toBe(0.3048);
    expect(metersPerUnit('decimal-ft')).toBe(0.3048);
    expect(metersPerUnit('mm')).toBe(0.001);
    expect(metersPerUnit('centimeter')).toBe(0.01);
    expect(metersPerUnit(undefined)).toBe(1);
  });

  it('convierte 40 cm a pies', () => {
    const [, y] = deltaToViewerUnits({ dx: 0, dy: 0.4, dz: 0 }, 0.3048);
    expect(y).toBeCloseTo(1.3123, 4);
  });
});

describe('ejes', () => {
  it('con ejes por defecto no gira el delta', () => {
    expect(rotateDelta({ dx: 0, dy: 0.4, dz: 0 })).toEqual([0, 0.4, 0]);
  });

  it('gira 90 grados el norte del caso hacia -x del modelo', () => {
    const [x, y] = rotateDelta({ dx: 0, dy: 1, dz: 0 }, axesRotatedBy(90));
    expect(x).toBeCloseTo(-1);
    expect(y).toBeCloseTo(0);
  });
});

describe('cajas', () => {
  const a = { min: [0, 0, 0], max: [1, 2, 3] } as const;
  const b = { min: [-1, 1, 1], max: [0.5, 5, 2] } as const;

  it('une cajas', () => {
    expect(unionBoxes([a, b])).toEqual({ min: [-1, 0, 0], max: [1, 5, 3] });
    expect(unionBoxes([])).toBeNull();
  });

  it('corrige por el offset global y la unidad', () => {
    const box = toWorldMeters(a, { x: 10, y: 0, z: 0 }, 0.5);
    expect(box.min).toEqual([5, 0, 0]);
    expect(box.max).toEqual([5.5, 1, 1.5]);
  });

  it('suma el delta a mano', () => {
    expect(shiftBox(a, { dx: 0, dy: 0.4, dz: 0 }).max).toEqual([1, 2.4, 3]);
  });
});

describe('easeInOut', () => {
  it('parte en 0, llega a 1 y pasa por la mitad', () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(2)).toBe(1);
  });
});

describe('matchesMark', () => {
  const props = (value: string, name = 'Mark') => ({
    dbId: 1,
    properties: [{ displayName: name, displayValue: value }],
  });

  it('compara la marca exacta sin mayúsculas', () => {
    expect(matchesMark(props('P-12'), 'p-12')).toBe(true);
    expect(matchesMark(props('P-120'), 'P-12')).toBe(false);
    expect(matchesMark(props('E-B-03', 'Marca'), 'E-B-03')).toBe(true);
    expect(matchesMark(props('P-12', 'Comments'), 'P-12')).toBe(false);
  });
});

describe('selectCaseModels', () => {
  const model = (file: string, discipline: ViewerModel['discipline']) => ({
    file,
    discipline,
    urn: file,
  });

  it('elige solo los modelos del caso y tolera su ausencia', () => {
    const all = [
      model('Snowdon_Struct.rvt', 'structural'),
      model('caso-estructura.rvt', 'structural'),
      model('caso-electrico.rvt', 'electrical'),
    ];
    expect(selectCaseModels(all).map((m) => m.file)).toEqual([
      'caso-estructura.rvt',
      'caso-electrico.rvt',
    ]);
    expect(selectCaseModels([])).toEqual([]);
    expect(selectCaseModels(all.slice(0, 1))).toEqual([]);
  });
});

describe('planScene', () => {
  const state = (patch: Partial<CaseFlowState>): CaseFlowState => ({
    change: null,
    clash: null,
    proposal: null,
    ...patch,
  });

  it('sin estado no hace nada', () => {
    expect(planScene(null)).toEqual({ moves: {}, tones: {} });
  });

  it('al publicar mueve P-12 y pinta el choque en rojo', () => {
    const plan = planScene(
      state({
        change,
        clash: { status: 'detectada' },
        proposal: proposal('propuesta'),
      }),
    );
    expect(plan.moves).toEqual({ 'P-12': change.delta });
    expect(plan.tones).toEqual({ 'P-12': 'clash', 'E-B-03': 'clash' });
  });

  it('al aplicar mueve también la bandeja y la pinta de verde', () => {
    const plan = planScene(
      state({
        change,
        clash: { status: 'resuelta' },
        proposal: proposal('aplicada'),
      }),
    );
    expect(Object.keys(plan.moves).sort()).toEqual(['E-B-03', 'P-12']);
    expect(plan.tones).toEqual({ 'E-B-03': 'fix' });
  });

  it('si Camila rechaza, la bandeja no se mueve y el choque sigue rojo', () => {
    const plan = planScene(
      state({
        change,
        clash: { status: 'detectada' },
        proposal: proposal('rechazada'),
      }),
    );
    expect(plan.moves['E-B-03']).toBeUndefined();
    expect(plan.tones['E-B-03']).toBe('clash');
  });
});
