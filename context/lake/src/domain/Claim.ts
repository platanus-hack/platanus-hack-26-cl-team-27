export type ClaimValue = number | string | boolean;

export type ClaimRole = 'afirma' | 'usa';

export interface ClaimDraft {
  readonly subject: string;
  readonly attribute: string;
  readonly value: ClaimValue;
  readonly unit: string | null;
  readonly role: ClaimRole;
  readonly locator: string;
}

export interface Claim extends ClaimDraft {
  readonly id: string;
  readonly revisionId: string;
}

export const sameValue = (a: ClaimValue, b: ClaimValue): boolean => a === b;
