import type { FlowBox, FlowElement, FlowProposal } from './flow-api.ts';

export const PLAN = {
  minX: 23.6,
  maxY: 8.9,
  scale: 100,
  width: 920,
  height: 420,
} as const;

export const AXIS_5_X = 24;
export const AXIS_6_X = 30;
export const AXIS_B_Y = 6;
export const TRAY_BASE_Y = [6.45, 6.75] as const;
export const TRAY_FALLBACK_X = [6, 32] as const;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const round = (value: number): number => Math.round(value * 100) / 100;

export const toSvgX = (x: number): number =>
  round((x - PLAN.minX) * PLAN.scale);

export const toSvgY = (y: number): number =>
  round((PLAN.maxY - y) * PLAN.scale);

export const lengthToSvg = (meters: number): number =>
  round(meters * PLAN.scale);

export const rectFromRange = (
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): Rect => ({
  x: toSvgX(x0),
  y: toSvgY(y1),
  width: lengthToSvg(x1 - x0),
  height: lengthToSvg(y1 - y0),
});

export const boxToRect = (box: FlowBox): Rect =>
  rectFromRange(box.min[0], box.max[0], box.min[1], box.max[1]);

export const intersectBoxes = (a: FlowBox, b: FlowBox): FlowBox | null => {
  const min = [0, 1, 2].map((i) => Math.max(a.min[i] ?? 0, b.min[i] ?? 0));
  const max = [0, 1, 2].map((i) => Math.min(a.max[i] ?? 0, b.max[i] ?? 0));
  if (min.some((value, i) => value >= (max[i] ?? 0))) return null;
  return {
    min: [min[0] ?? 0, min[1] ?? 0, min[2] ?? 0],
    max: [max[0] ?? 0, max[1] ?? 0, max[2] ?? 0],
  };
};

export const slideOffset = (dy: number, applied: boolean): number =>
  applied ? -lengthToSvg(dy) : 0;

export const isApplied = (proposal: FlowProposal | null): boolean =>
  proposal !== null &&
  (proposal.status === 'aceptada' ||
    proposal.status === 'aplicada' ||
    proposal.status === 'resuelta');

export const trayRange = (
  elements: readonly FlowElement[],
): readonly [number, number] => {
  const tray = elements.find((element) => element.id === 'E-B-03');
  return tray ? [tray.box.min[0], tray.box.max[0]] : TRAY_FALLBACK_X;
};

export const trayBox = (
  elements: readonly FlowElement[],
  zFrom = 2.25,
  zTo = 2.35,
): FlowBox => {
  const [x0, x1] = trayRange(elements);
  return { min: [x0, TRAY_BASE_Y[0], zFrom], max: [x1, TRAY_BASE_Y[1], zTo] };
};

export const originalBox = (box: FlowBox, dy: number): FlowBox => ({
  min: [box.min[0], round(box.min[1] - dy), box.min[2]],
  max: [box.max[0], round(box.max[1] - dy), box.max[2]],
});
