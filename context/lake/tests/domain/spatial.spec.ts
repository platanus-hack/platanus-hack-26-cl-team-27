import {
  type Box,
  type ClearanceRule,
  type SpatialElement,
  canAdvance,
  detectClashes,
  gapBetween,
  makeBox,
  proposeFix,
  translate,
} from '../../src/domain/spatial/index.ts';

const RULES: ClearanceRule[] = [
  { a: 'estructura', b: 'eléctricas', meters: 0.15 },
  { a: 'eléctricas', b: 'arquitectura', meters: 0.05 },
  { a: 'estructura', b: 'arquitectura', meters: null },
];

const el = (
  id: string,
  discipline: string,
  box: Box,
  support = false,
): SpatialElement => ({ id, discipline, box, support });

const pillar = el(
  'P-12',
  'estructura',
  makeBox([29.8, 5.7, 0], [30.2, 6.3, 2.55]),
);
const tray = el(
  'E-B-03',
  'eléctricas',
  makeBox([26, 6.45, 2.25], [32, 6.75, 2.35]),
);
const collector = el('B2', 'sanitarias', makeBox([5, 6.4, 2.2], [7, 6.6, 2.3]));
const ceiling = el(
  'cielo',
  'arquitectura',
  makeBox([0, 0, 2.4], [33, 18, 2.6]),
);
const slab = el(
  'losa',
  'estructura',
  makeBox([0, 0, 2.55], [33, 18, 2.75]),
  true,
);

const movedPillar = {
  ...pillar,
  box: translate(pillar.box, { dx: 0, dy: 0.4, dz: 0 }),
};

describe('detectClashes', () => {
  it.each([
    [
      'antes del cambio cumple justo la holgura',
      [pillar, tray, collector, ceiling, slab],
      0,
    ],
    [
      'después del cambio el pilar atraviesa la bandeja',
      [movedPillar, tray, collector, ceiling, slab],
      1,
    ],
  ])('%s', (_name, elements, count) => {
    expect(detectClashes(elements, RULES, 'y')).toHaveLength(count);
  });

  it('reporta la penetración sobre el eje de la causa', () => {
    const [clash] = detectClashes(
      [movedPillar, tray, collector, ceiling],
      RULES,
      'y',
    );
    expect(clash).toMatchObject({
      a: 'P-12',
      b: 'E-B-03',
      axis: 'y',
      penetration: 0.25,
      clearance: 0.15,
    });
  });

  it('los soportes nunca chocan', () => {
    const through = el(
      'losa-2',
      'estructura',
      makeBox([26, 6, 2.2], [33, 7, 2.4]),
      true,
    );
    expect(detectClashes([through, tray], RULES, 'y')).toEqual([]);
  });

  it('la holgura al cielo falso se cumple justo', () => {
    expect(gapBetween(tray.box, ceiling.box)).toBe(0.05);
    expect(detectClashes([tray, ceiling], RULES, 'y')).toEqual([]);
  });

  it('dos disciplinas sin regla solo chocan si se intersectan', () => {
    const touching = el(
      't',
      'sanitarias',
      makeBox([26, 6.75, 2.25], [32, 7, 2.35]),
    );
    const inside = el(
      'i',
      'sanitarias',
      makeBox([26, 6.7, 2.25], [32, 7, 2.35]),
    );
    expect(detectClashes([tray, touching], RULES, 'y')).toEqual([]);
    expect(detectClashes([tray, inside], RULES, 'y')).toHaveLength(1);
  });
});

describe('proposeFix', () => {
  const base = {
    moving: tray,
    cause: movedPillar,
    rules: RULES,
    axis: 'y' as const,
    sign: 1 as const,
  };

  it('el caso se arregla con +0,40 m en y y todos los chequeos en OK', () => {
    const fix = proposeFix({
      ...base,
      others: [movedPillar, collector, ceiling],
    });
    expect(fix).not.toBeNull();
    expect(fix?.delta).toEqual({ dx: 0, dy: 0.4, dz: 0 });
    expect(fix?.box.min[1]).toBe(6.85);
    expect(fix?.box.max[1]).toBe(7.15);
    expect(fix?.box.min[0]).toBe(26);
    expect(fix?.box.max[0]).toBe(32);
    expect(fix?.clearanceAfter).toBe(0.15);
    expect(fix?.checks.map((check) => check.ok)).toEqual([true, true, true]);
  });

  it('prueba el siguiente múltiplo si el primero choca', () => {
    const duct = el(
      'ducto',
      'sanitarias',
      makeBox([26, 6.8, 2.2], [33, 6.95, 2.4]),
    );
    const fix = proposeFix({
      ...base,
      others: [movedPillar, collector, ceiling, duct],
    });
    expect(fix?.delta.dy).toBe(0.5);
  });

  it('no hay arreglo si ningún candidato hasta 1,0 m sirve', () => {
    const wall = el(
      'muro',
      'sanitarias',
      makeBox([26, 6.8, 2.2], [33, 8.5, 2.4]),
    );
    expect(
      proposeFix({ ...base, others: [movedPillar, collector, ceiling, wall] }),
    ).toBeNull();
  });

  it('también funciona hacia el sur', () => {
    const south = {
      ...base,
      moving: { ...tray, box: makeBox([26, 5.65, 2.25], [32, 5.95, 2.35]) },
      sign: -1 as const,
    };
    const fix = proposeFix({ ...south, cause: pillar, others: [pillar] });
    expect(fix?.delta.dy).toBe(-0.4);
  });
});

describe('canAdvance', () => {
  it.each([
    ['propuesta', 'aceptada', true],
    ['propuesta', 'rechazada', true],
    ['aceptada', 'aplicada', true],
    ['aplicada', 'resuelta', true],
    ['propuesta', 'resuelta', false],
    ['resuelta', 'propuesta', false],
    ['rechazada', 'aceptada', false],
  ] as const)('%s → %s: %s', (from, to, expected) => {
    expect(canAdvance(from, to)).toBe(expected);
  });
});
