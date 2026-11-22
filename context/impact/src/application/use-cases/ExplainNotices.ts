import type { ChangeBrief } from '../../domain/ConflictSuggestion.ts';
import {
  type NoticeReason,
  type ReasonRecipient,
  screenReasons,
} from '../../domain/NoticeReason.ts';
import type { ReasonWriter } from '../ports/ReasonWriter.ts';

export interface ExplainNoticesInput {
  readonly change: ChangeBrief;
  readonly recipients: readonly ReasonRecipient[];
}

export class ExplainNotices {
  private readonly writer: ReasonWriter;

  constructor(writer: ReasonWriter) {
    this.writer = writer;
  }

  async execute(input: ExplainNoticesInput): Promise<NoticeReason[]> {
    if (input.recipients.length === 0) return [];
    const reasons = await this.writer.write({
      change: input.change,
      recipients: input.recipients,
    });
    return screenReasons(reasons, input.recipients, input.change.summary);
  }
}
