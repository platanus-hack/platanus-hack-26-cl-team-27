import { clampProbability } from './Probability.ts';
import {
  findAttribute,
  type ClaimValue,
  type ProjectVocabulary,
} from './Vocabulary.ts';

export type ClaimRole = 'afirma' | 'usa';

export interface ClaimCandidate {
  readonly subject: string;
  readonly attribute: string;
  readonly value: ClaimValue;
  readonly unit: string | null;
  readonly role: ClaimRole;
  readonly locator: string;
  readonly confidence: number;
}

export interface RejectedClaim {
  readonly candidate: ClaimCandidate;
  readonly reason: string;
}

export interface ScreenedClaims {
  readonly accepted: ClaimCandidate[];
  readonly rejected: RejectedClaim[];
}

const formatConfidence = (value: number): string =>
  value.toFixed(2).replace('.', ',');

const rejectionOf = (
  candidate: ClaimCandidate,
  vocabulary: ProjectVocabulary,
  minConfidence: number,
): string | null => {
  const attribute = findAttribute(
    vocabulary,
    candidate.subject,
    candidate.attribute,
  );
  if (!attribute) return 'El sujeto o el atributo no está en el proyecto';
  if (attribute.unit !== null && typeof candidate.value !== 'number') {
    return `Se esperaba un número en ${attribute.unit}`;
  }
  if (
    attribute.unit !== null &&
    candidate.unit !== null &&
    candidate.unit !== attribute.unit
  ) {
    return `La unidad es ${candidate.unit} y el proyecto usa ${attribute.unit}`;
  }
  if (candidate.locator.trim() === '') return 'No dice dónde lo leyó';
  if (!Number.isFinite(candidate.confidence)) return 'Sin confianza';
  const confidence = clampProbability(candidate.confidence);
  if (confidence < minConfidence) {
    return `Confianza ${formatConfidence(confidence)}, bajo el mínimo de ${formatConfidence(minConfidence)}`;
  }
  return null;
};

const slotOf = (claim: ClaimCandidate): string =>
  `${claim.subject}\u0000${claim.attribute}\u0000${claim.role}`;

export const screenClaims = (
  candidates: readonly ClaimCandidate[],
  vocabulary: ProjectVocabulary,
  minConfidence: number,
): ScreenedClaims => {
  const rejected: RejectedClaim[] = [];
  const best = new Map<string, ClaimCandidate>();
  for (const candidate of candidates) {
    const reason = rejectionOf(candidate, vocabulary, minConfidence);
    if (reason) {
      rejected.push({ candidate, reason });
      continue;
    }
    const attribute = findAttribute(
      vocabulary,
      candidate.subject,
      candidate.attribute,
    );
    const claim: ClaimCandidate = {
      ...candidate,
      unit: attribute?.unit ?? null,
      locator: candidate.locator.trim(),
      confidence: clampProbability(candidate.confidence),
    };
    const slot = slotOf(claim);
    const previous = best.get(slot);
    if (!previous) {
      best.set(slot, claim);
      continue;
    }
    const [kept, dropped] =
      claim.confidence > previous.confidence
        ? [claim, previous]
        : [previous, claim];
    best.set(slot, kept);
    rejected.push({
      candidate: dropped,
      reason: 'Otra lectura del mismo valor tiene más confianza',
    });
  }
  return { accepted: [...best.values()], rejected };
};
