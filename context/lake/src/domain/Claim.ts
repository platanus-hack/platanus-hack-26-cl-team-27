export type ClaimValue = number | string | boolean;

export type ClaimRole = 'afirma' | 'usa';

export interface ClaimDraft {
  readonly subject: string;
  readonly attribute: string;
  readonly value: ClaimValue;
  readonly unit: string | null;
  readonly role: ClaimRole;
  readonly locator: string;
  readonly confidence?: number | null;
}

export interface Claim extends ClaimDraft {
  readonly id: string;
  readonly revisionId: string;
  readonly chunkId: string | null;
  readonly confidence: number | null;
}

export const sameValue = (a: ClaimValue, b: ClaimValue): boolean => a === b;
