import {
  type Axis,
  type Box,
  axisIndex,
  gapBetween,
  round,
  translate,
} from './Box.ts';
import {
  type ClearanceRule,
  type SpatialElement,
  clashesWith,
  clearanceFor,
} from './clash.ts';

const FIX_STEP = 0.05;

const FIX_LIMIT = 1.0;

export interface FixInput {
  readonly moving: SpatialElement;
  readonly others: readonly SpatialElement[];
  readonly rules: readonly ClearanceRule[];
  readonly cause: SpatialElement;
  readonly axis: Axis;
  readonly sign: 1 | -1;
}

export interface FixCheck {
  readonly elementId: string;
  readonly ok: boolean;
  readonly gap: number;
}

export interface Fix {
  readonly delta: {
    readonly dx: number;
    readonly dy: number;
    readonly dz: number;
  };
  readonly distance: number;
  readonly box: Box;
  readonly clearanceAfter: number;
  readonly checks: FixCheck[];
}

const roundUpToStep = (value: number): number =>
  round(Math.ceil(round(value / FIX_STEP)) * FIX_STEP);

const deltaOf = (axis: Axis, amount: number) => ({
  dx: axis === 'x' ? amount : 0,
  dy: axis === 'y' ? amount : 0,
  dz: axis === 'z' ? amount : 0,
});

const penetrationOf = (a: Box, b: Box, axis: Axis, sign: 1 | -1): number => {
  const i = axisIndex(axis);
  return sign === 1 ? round(b.max[i] - a.min[i]) : round(a.max[i] - b.min[i]);
};

export const proposeFix = (input: FixInput): Fix | null => {
  const { moving, others, rules, cause, axis, sign } = input;
  const clearance =
    clearanceFor(rules, moving.discipline, cause.discipline) ?? 0;
  const needed = Math.max(0, penetrationOf(moving.box, cause.box, axis, sign));
  const first = roundUpToStep(needed + clearance);
  for (
    let distance = Math.max(first, FIX_STEP);
    distance <= FIX_LIMIT + 1e-9;
    distance = round(distance + FIX_STEP)
  ) {
    const delta = deltaOf(axis, round(sign * distance));
    const box = translate(moving.box, delta);
    const moved: SpatialElement = { ...moving, box };
    const checks = others.map((other) => ({
      elementId: other.id,
      ok: !clashesWith(moved, other, rules),
      gap: gapBetween(box, other.box),
    }));
    if (checks.every((check) => check.ok)) {
      return {
        delta,
        distance,
        box,
        clearanceAfter: gapBetween(box, cause.box),
        checks,
      };
    }
  }
  return null;
};
