import type { Discrepancy } from '../../domain/Discrepancy.ts';
import { ValidationError } from '../errors.ts';
import type { DiscrepancyRepository } from '../ports/DiscrepancyRepository.ts';

export interface DismissDiscrepancyInput {
  readonly discrepancyId: string;
  readonly actorId?: string;
  readonly note?: string | null;
}

export class DismissDiscrepancy {
  private readonly discrepancies: DiscrepancyRepository;

  constructor(discrepancies: DiscrepancyRepository) {
    this.discrepancies = discrepancies;
  }

  async execute(input: DismissDiscrepancyInput): Promise<Discrepancy> {
    const discrepancy = await this.discrepancies.findById(input.discrepancyId);
    if (!discrepancy) throw new ValidationError('La discrepancia no existe');
    if (input.actorId !== undefined && input.actorId !== discrepancy.ownerId) {
      throw new ValidationError(
        'Solo el dueño del valor descarta la discrepancia',
      );
    }
    if (discrepancy.status === 'dismissed') return discrepancy;
    if (discrepancy.status !== 'open') {
      throw new ValidationError('La discrepancia ya está respaldada');
    }
    return this.discrepancies.resolve(discrepancy.id, {
      status: 'dismissed',
      backedByRevisionId: null,
      note: input.note?.trim() || null,
      resolvedAt: new Date(),
    });
  }
}
