import type {
  Acknowledgement,
  AcknowledgementDraft,
} from '../../domain/Acknowledgement.ts';

export interface AcknowledgementRepository {
  create(draft: AcknowledgementDraft): Promise<Acknowledgement>;
  list(): Promise<Acknowledgement[]>;
  clear(): Promise<void>;
}
