import { applyOverlapVote } from '../../domain/Overlap.ts';
import type {
  Overlap,
  OverlapStatus,
  OverlapVoteKind,
} from '../../domain/Overlap.ts';
import { ValidationError } from '../errors.ts';
import type { OverlapRepository } from '../ports/OverlapRepository.ts';

export interface VoteOverlapInput {
  readonly overlapId: string;
  readonly validatorId: string;
  readonly kind: OverlapVoteKind;
  readonly note?: string | null;
}

export interface VotedOverlap {
  readonly overlap: Overlap;
  readonly changed: boolean;
  readonly from: OverlapStatus;
}

export class VoteOverlap {
  private readonly overlaps: OverlapRepository;

  constructor(overlaps: OverlapRepository) {
    this.overlaps = overlaps;
  }

  async execute(input: VoteOverlapInput): Promise<VotedOverlap> {
    const overlap = await this.overlaps.findById(input.overlapId);
    if (!overlap) throw new ValidationError('El solapamiento no existe');
    if (!overlap.validators.includes(input.validatorId)) {
      throw new ValidationError('Quien vota no valida este solapamiento');
    }
    const previous = overlap.votes.find(
      (vote) => vote.validatorId === input.validatorId,
    );
    if (previous) {
      if (previous.kind === input.kind) {
        return { overlap, changed: false, from: overlap.status };
      }
      throw new ValidationError('El validador ya respondió este solapamiento');
    }
    if (overlap.status === 'descartado' || overlap.status === 'resuelto') {
      throw new ValidationError('El solapamiento ya no admite votos');
    }
    const next = applyOverlapVote(
      overlap,
      input.validatorId,
      input.kind,
      input.note?.trim() || null,
      new Date(),
    );
    await this.overlaps.save(next);
    return { overlap: next, changed: true, from: overlap.status };
  }
}
