import type { Acknowledgement } from '../../domain/Acknowledgement.ts';
import { ValidationError } from '../errors.ts';
import { loadLakeState } from '../loadLakeState.ts';
import type { AcknowledgementRepository } from '../ports/AcknowledgementRepository.ts';
import type { BaselineRepository } from '../ports/BaselineRepository.ts';
import type { ClaimRepository } from '../ports/ClaimRepository.ts';
import type { ProposalRepository } from '../ports/ProposalRepository.ts';
import type { RevisionRepository } from '../ports/RevisionRepository.ts';

export interface AcknowledgeStaleInput {
  readonly documentId: string;
  readonly ownerId: string;
  readonly note: string;
}

export class AcknowledgeStale {
  private readonly revisions: RevisionRepository;
  private readonly claims: ClaimRepository;
  private readonly baseline: BaselineRepository;
  private readonly proposals: ProposalRepository;
  private readonly acknowledgements: AcknowledgementRepository;

  constructor(
    revisions: RevisionRepository,
    claims: ClaimRepository,
    baseline: BaselineRepository,
    proposals: ProposalRepository,
    acknowledgements: AcknowledgementRepository,
  ) {
    this.revisions = revisions;
    this.claims = claims;
    this.baseline = baseline;
    this.proposals = proposals;
    this.acknowledgements = acknowledgements;
  }

  async execute(input: AcknowledgeStaleInput): Promise<Acknowledgement> {
    const note = input.note.trim();
    if (!note) {
      throw new ValidationError('Confirmar sin cambio exige una nota');
    }
    const state = await loadLakeState(this);
    const document = state.stale.find(
      (candidate) => candidate.documentId === input.documentId,
    );
    if (!document) {
      throw new ValidationError('El documento no está desfasado');
    }
    if (document.acknowledgement) return document.acknowledgement;
    return this.acknowledgements.create({
      documentId: document.documentId,
      revisionId: document.revisionId,
      signature: document.signature,
      ownerId: input.ownerId,
      note,
    });
  }
}
