import { type Axis, type Box, gapBetween, EPSILON, overlapOn } from './Box.ts';

export interface SpatialElement {
  readonly id: string;
  readonly discipline: string;
  readonly box: Box;
  readonly support: boolean;
}

export interface ClearanceRule {
  readonly a: string;
  readonly b: string;
  readonly meters: number | null;
}

export interface Clash {
  readonly a: string;
  readonly b: string;
  readonly penetration: number;
  readonly axis: Axis;
  readonly clearance: number;
}

export const clearanceFor = (
  rules: readonly ClearanceRule[],
  first: string,
  second: string,
): number | null => {
  const rule = rules.find(
    (item) =>
      (item.a === first && item.b === second) ||
      (item.a === second && item.b === first),
  );
  return rule ? rule.meters : 0;
};

export const clashesWith = (
  a: SpatialElement,
  b: SpatialElement,
  rules: readonly ClearanceRule[],
): boolean => {
  if (a.support || b.support) return false;
  const clearance = clearanceFor(rules, a.discipline, b.discipline);
  return clearance !== null && gapBetween(a.box, b.box) < clearance - EPSILON;
};

export const detectClashes = (
  elements: readonly SpatialElement[],
  rules: readonly ClearanceRule[],
  axis: Axis,
): Clash[] => {
  const clashes: Clash[] = [];
  elements.forEach((a, i) => {
    elements.slice(i + 1).forEach((b) => {
      if (!clashesWith(a, b, rules)) return;
      const clearance = clearanceFor(rules, a.discipline, b.discipline) ?? 0;
      clashes.push({
        a: a.id,
        b: b.id,
        axis,
        clearance,
        penetration: Math.max(0, overlapOn(a.box, b.box, axis)),
      });
    });
  });
  return clashes;
};
