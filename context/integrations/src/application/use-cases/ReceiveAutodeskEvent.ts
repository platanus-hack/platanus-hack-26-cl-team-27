import {
  type AutodeskChange,
  parseAutodeskWebhook,
} from '../../domain/autodesk/AutodeskChange.ts';
import type {
  AutodeskChangeListener,
  AutodeskEventRepository,
} from '../ports/index.ts';

export type AutodeskOutcome = {
  readonly kind: 'recorded' | 'duplicate';
  readonly change: AutodeskChange;
};

export class ReceiveAutodeskEvent {
  private readonly events: AutodeskEventRepository;
  private readonly listener: AutodeskChangeListener;
  private readonly now: () => Date;

  constructor(
    events: AutodeskEventRepository,
    listener: AutodeskChangeListener,
    now: () => Date = () => new Date(),
  ) {
    this.events = events;
    this.listener = listener;
    this.now = now;
  }

  async execute(body: unknown): Promise<AutodeskOutcome> {
    const change = parseAutodeskWebhook(body);
    if (!(await this.events.recordIfNew(change, this.now()))) {
      return { kind: 'duplicate', change };
    }
    await this.listener.changed(change);
    return { kind: 'recorded', change };
  }
}
