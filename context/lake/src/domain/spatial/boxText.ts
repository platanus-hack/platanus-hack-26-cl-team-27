import { type Box, type Vec3, makeBox } from './Box.ts';

const DECIMALS = 4;

const trim = (value: number): number => Number(value.toFixed(DECIMALS));

const range = (min: number, max: number): string =>
  `${trim(min)}..${trim(max)}`;

const PATTERN =
  /^x (-?[\d.]+)\.\.(-?[\d.]+) · y (-?[\d.]+)\.\.(-?[\d.]+) · z (-?[\d.]+)\.\.(-?[\d.]+)$/;

export const roundBox = (box: Box): Box => {
  const side = (vec: Vec3): Vec3 => [trim(vec[0]), trim(vec[1]), trim(vec[2])];
  return { min: side(box.min), max: side(box.max) };
};

export const encodeBox = (box: Box): string =>
  `x ${range(box.min[0], box.max[0])} · y ${range(box.min[1], box.max[1])} · z ${range(box.min[2], box.max[2])}`;

export const decodeBox = (text: string): Box | null => {
  const match = PATTERN.exec(text);
  if (!match) return null;
  const numbers = match.slice(1).map(Number);
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  const [x0, x1, y0, y1, z0, z1] = numbers as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return roundBox(makeBox([x0, y0, z0], [x1, y1, z1]));
};
