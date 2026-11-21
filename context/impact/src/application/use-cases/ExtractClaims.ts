import { isEmptyEvidence, type Evidence } from '../../domain/Evidence.ts';
import {
  screenClaims,
  type ScreenedClaims,
} from '../../domain/ExtractedClaim.ts';
import {
  isValidThreshold,
  MIN_CLAIM_CONFIDENCE,
} from '../../domain/Probability.ts';
import type { ProjectVocabulary } from '../../domain/Vocabulary.ts';
import { ValidationError } from '../errors.ts';
import type { ClaimReader } from '../ports/ClaimReader.ts';

export interface ExtractClaimsInput {
  readonly evidence: Evidence;
  readonly vocabulary: ProjectVocabulary;
  readonly minConfidence?: number;
}

export class ExtractClaims {
  private readonly reader: ClaimReader;

  constructor(reader: ClaimReader) {
    this.reader = reader;
  }

  async execute(input: ExtractClaimsInput): Promise<ScreenedClaims> {
    const minConfidence = input.minConfidence ?? MIN_CLAIM_CONFIDENCE;
    if (!isValidThreshold(minConfidence)) {
      throw new ValidationError('La confianza mínima debe estar entre 0 y 1');
    }
    if (isEmptyEvidence(input.evidence)) {
      throw new ValidationError('No hay nada que leer en la evidencia');
    }
    const candidates = await this.reader.read({
      evidence: input.evidence,
      vocabulary: input.vocabulary,
    });
    return screenClaims(candidates, input.vocabulary, minConfidence);
  }
}
