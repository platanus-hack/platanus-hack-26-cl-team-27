export type ProbabilityBand = 'alta' | 'media' | 'baja';

export const ASK_THRESHOLD = 0.5;
export const MIN_CLAIM_CONFIDENCE = 0.7;

const HIGH_BAND = 0.7;
const MEDIUM_BAND = 0.4;

export const clampProbability = (value: number): number =>
  Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;

export const probabilityBand = (probability: number): ProbabilityBand => {
  if (probability >= HIGH_BAND) return 'alta';
  if (probability >= MEDIUM_BAND) return 'media';
  return 'baja';
};

export const isValidThreshold = (threshold: number): boolean =>
  Number.isFinite(threshold) && threshold > 0 && threshold <= 1;
