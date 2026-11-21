import {
  clampProbability,
  isValidThreshold,
  probabilityBand,
} from '../../src/domain/Probability.ts';
import { stableStringify } from '../../src/domain/stableStringify.ts';

describe('probabilidad', () => {
  it('acota a [0, 1] con dos decimales', () => {
    expect(clampProbability(-0.2)).toBe(0);
    expect(clampProbability(0.726)).toBe(0.73);
    expect(clampProbability(3)).toBe(1);
  });

  it('asigna bandas alta, media y baja', () => {
    expect(probabilityBand(0.7)).toBe('alta');
    expect(probabilityBand(0.4)).toBe('media');
    expect(probabilityBand(0.39)).toBe('baja');
  });

  it('acepta umbrales en (0, 1]', () => {
    expect(isValidThreshold(1)).toBe(true);
    expect(isValidThreshold(0)).toBe(false);
    expect(isValidThreshold(Number.NaN)).toBe(false);
  });
});

describe('stableStringify', () => {
  it('no depende del orden de las llaves', () => {
    expect(stableStringify({ b: 1, a: { d: [2, { y: 1, x: 0 }], c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: [2, { x: 0, y: 1 }] }, b: 1 }),
    );
  });

  it('respeta el orden de los arreglos', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});
