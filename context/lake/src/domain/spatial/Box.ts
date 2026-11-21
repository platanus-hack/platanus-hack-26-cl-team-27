export type Vec3 = readonly [number, number, number];

export interface Box {
  readonly min: Vec3;
  readonly max: Vec3;
}

export type Axis = 'x' | 'y' | 'z';

export const AXES: readonly Axis[] = ['x', 'y', 'z'];

const INDEX: Readonly<Record<Axis, 0 | 1 | 2>> = { x: 0, y: 1, z: 2 };

const PRECISION = 1_000_000;

export const EPSILON = 1e-6;

export const round = (value: number): number =>
  Math.round(value * PRECISION) / PRECISION;

export const makeBox = (min: Vec3, max: Vec3): Box => ({
  min: [round(min[0]), round(min[1]), round(min[2])],
  max: [round(max[0]), round(max[1]), round(max[2])],
});

export const translate = (
  box: Box,
  delta: { readonly dx: number; readonly dy: number; readonly dz: number },
): Box =>
  makeBox(
    [box.min[0] + delta.dx, box.min[1] + delta.dy, box.min[2] + delta.dz],
    [box.max[0] + delta.dx, box.max[1] + delta.dy, box.max[2] + delta.dz],
  );

export const axisIndex = (axis: Axis): 0 | 1 | 2 => INDEX[axis];

export const overlapOn = (a: Box, b: Box, axis: Axis): number => {
  const i = INDEX[axis];
  return round(Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]));
};

export const gapBetween = (a: Box, b: Box): number =>
  round(Math.max(...AXES.map((axis) => -overlapOn(a, b, axis))));

export const centerOn = (box: Box, axis: Axis): number => {
  const i = INDEX[axis];
  return round((box.min[i] + box.max[i]) / 2);
};
