import type { ClaimDraft, ClaimRole, ClaimValue } from './Claim.ts';

export const CHUNK_KINDS = [
  'fila',
  'anotacion',
  'acuerdo',
  'mensaje',
  'parametro',
  'texto',
] as const;

export type ChunkKind = (typeof CHUNK_KINDS)[number];

export interface RejectedClaimDraft {
  readonly subject: string;
  readonly attribute: string;
  readonly value: ClaimValue;
  readonly unit: string | null;
  readonly role: ClaimRole;
  readonly confidence: number;
  readonly reason: string;
}

export interface ChunkDraft {
  readonly locator: string;
  readonly kind: ChunkKind;
  readonly text: string | null;
  readonly claims: readonly ClaimDraft[];
  readonly rejected: readonly RejectedClaimDraft[];
}

export interface Chunk {
  readonly id: string;
  readonly revisionId: string;
  readonly position: number;
  readonly locator: string;
  readonly kind: ChunkKind;
  readonly text: string | null;
  readonly rejected: readonly RejectedClaimDraft[];
}

export const chunksFromClaims = (
  claims: readonly ClaimDraft[],
  kind: ChunkKind = 'fila',
): ChunkDraft[] => {
  const byLocator = new Map<string, ClaimDraft[]>();
  for (const claim of claims) {
    const group = byLocator.get(claim.locator) ?? [];
    group.push(claim);
    byLocator.set(claim.locator, group);
  }
  return [...byLocator.entries()].map(([locator, group]) => ({
    locator,
    kind,
    text: null,
    claims: group,
    rejected: [],
  }));
};
