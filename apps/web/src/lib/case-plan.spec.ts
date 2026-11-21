import { describe, expect, it } from 'vitest';

import {
  boxToRect,
  intersectBoxes,
  isApplied,
  slideOffset,
  toSvgX,
  toSvgY,
  trayBox,
} from './case-plan.ts';
import type { FlowProposal } from './flow-api.ts';

describe('plan geometry', () => {
  it('maps meters to SVG coordinates with north up', () => {
    expect(toSvgX(30)).toBe(640);
    expect(toSvgY(6)).toBe(290);
    expect(toSvgY(6.7)).toBeLessThan(toSvgY(6.1));
  });

  it('turns a box into a rect', () => {
    expect(boxToRect({ min: [29.8, 6.1, 0], max: [30.2, 6.7, 2.55] })).toEqual({
      x: 620,
      y: 220,
      width: 40,
      height: 60,
    });
  });

  it('finds the clash between the pillar and the tray', () => {
    const pillar = { min: [29.8, 6.1, 0], max: [30.2, 6.7, 2.55] } as const;
    const hit = intersectBoxes(pillar, trayBox([]));
    expect(hit?.min[1]).toBeCloseTo(6.45);
    expect(hit?.max[1]).toBeCloseTo(6.7);
  });

  it('finds no clash when the boxes only touch or are apart', () => {
    const pillar = { min: [29.8, 5.7, 0], max: [30.2, 6.3, 2.55] } as const;
    expect(intersectBoxes(pillar, trayBox([]))).toBeNull();
  });

  it('slides north only once applied', () => {
    expect(slideOffset(0.4, false)).toBe(0);
    expect(slideOffset(0.4, true)).toBe(-40);
  });

  it('knows when the proposal is applied', () => {
    const make = (status: FlowProposal['status']) =>
      ({ status }) as FlowProposal;
    expect(isApplied(null)).toBe(false);
    expect(isApplied(make('propuesta'))).toBe(false);
    expect(isApplied(make('rechazada'))).toBe(false);
    expect(isApplied(make('resuelta'))).toBe(true);
  });
});
