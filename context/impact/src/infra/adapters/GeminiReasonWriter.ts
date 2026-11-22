import type {
  ReasonQuery,
  ReasonWriter,
} from '../../application/ports/ReasonWriter.ts';
import type { NoticeReason } from '../../domain/NoticeReason.ts';
import {
  REASONS_SYSTEM,
  reasonsPrompt,
  ReasonsSchema,
} from './ClaudeReasonWriter.ts';
import { generateStructured, type GeminiOptions } from './geminiRequest.ts';

export class GeminiReasonWriter implements ReasonWriter {
  private readonly options: GeminiOptions;

  constructor(options: GeminiOptions) {
    this.options = options;
  }

  async write(query: ReasonQuery): Promise<NoticeReason[]> {
    const output = await generateStructured(
      this.options,
      REASONS_SYSTEM,
      [{ text: reasonsPrompt(query) }],
      ReasonsSchema,
    );
    return output.reasons;
  }
}
