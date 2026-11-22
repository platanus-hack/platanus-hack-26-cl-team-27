import type { ChangeBrief } from '../../domain/ConflictSuggestion.ts';
import type {
  NoticeReason,
  ReasonRecipient,
} from '../../domain/NoticeReason.ts';

export interface ReasonQuery {
  readonly change: ChangeBrief;
  readonly recipients: readonly ReasonRecipient[];
}

export interface ReasonWriter {
  write(query: ReasonQuery): Promise<NoticeReason[]>;
}
