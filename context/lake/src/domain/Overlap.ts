import type { AreaCell, OverlapRelation } from './AreaCell.ts';

export type OverlapKind = 'mismo-elemento' | 'misma-area' | 'simultaneo';

export type OverlapStatus =
  'abierto' | 'descartado' | 'confirmado' | 'resuelto';

export type OverlapVoteKind = 'se_tocan' | 'no_se_tocan';

export type OverlapResolution =
  'retirada' | 'reemplazada' | 'sin_area_comun' | 'otra_propuesta_cerrada';

export interface OverlapVote {
  readonly validatorId: string;
  readonly kind: OverlapVoteKind;
  readonly note: string | null;
  readonly at: Date;
}

export interface OverlapBacking {
  readonly documentId: string;
  readonly label: string;
  readonly ownerId: string;
}

export interface OverlapDraft {
  readonly proposalId: string | null;
  readonly otherProposalId: string | null;
  readonly revisionId: string;
  readonly chunkLocator: string;
  readonly kind: OverlapKind;
  readonly area: AreaCell | null;
  readonly relation: OverlapRelation | null;
  readonly subjectId: string;
  readonly otherSubjectId: string;
  readonly otherBacking: OverlapBacking;
  readonly validators: readonly string[];
}

export interface Overlap extends OverlapDraft {
  readonly id: string;
  readonly status: OverlapStatus;
  readonly votes: readonly OverlapVote[];
  readonly resolution: OverlapResolution | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
}

export const isLiveOverlap = (overlap: Pick<Overlap, 'status'>): boolean =>
  overlap.status === 'abierto' || overlap.status === 'confirmado';

export const blocksProposal = (
  overlap: Pick<Overlap, 'status' | 'proposalId' | 'otherProposalId'>,
  proposalId: string,
): boolean =>
  isLiveOverlap(overlap) &&
  (overlap.proposalId === proposalId || overlap.otherProposalId === proposalId);

export const decideOverlap = (
  overlap: Pick<Overlap, 'validators' | 'votes'>,
): 'abierto' | 'descartado' | 'confirmado' => {
  if (overlap.votes.some((vote) => vote.kind === 'se_tocan')) {
    return 'confirmado';
  }
  const voted = new Set(overlap.votes.map((vote) => vote.validatorId));
  return overlap.validators.every((id) => voted.has(id))
    ? 'descartado'
    : 'abierto';
};

export const applyOverlapVote = (
  overlap: Overlap,
  validatorId: string,
  kind: OverlapVoteKind,
  note: string | null,
  at: Date,
): Overlap => {
  const votes = [
    ...overlap.votes.filter((vote) => vote.validatorId !== validatorId),
    { validatorId, kind, note, at },
  ];
  return { ...overlap, votes, status: decideOverlap({ ...overlap, votes }) };
};

export const overlapKey = (
  overlap: Pick<
    OverlapDraft,
    'kind' | 'subjectId' | 'otherSubjectId' | 'area' | 'proposalId'
  >,
): string => {
  const pair = [overlap.subjectId, overlap.otherSubjectId].sort().join('|');
  const cell = overlap.area
    ? `${overlap.area.nivel}/${overlap.area.celda}`
    : `p:${overlap.proposalId ?? ''}`;
  return `${overlap.kind === 'mismo-elemento' ? 'e' : 'a'}|${pair}|${cell}`;
};
