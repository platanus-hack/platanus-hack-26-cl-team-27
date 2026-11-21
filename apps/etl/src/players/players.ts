import {
  Api,
  ApiError,
  isSeatHeld,
  type ApiEvent,
  type ProposalView,
} from '../load/api.ts';
import { actionIdOf } from '../load/index.ts';
import {
  AUTHOR_ID,
  disputeNotice,
  isActiveStatus,
  planReopens,
  planVotes,
  type PlannedReopen,
  type PlannedVote,
} from './plan.ts';

export type Schedule = (ms: number, run: () => void) => () => void;

export const timerSchedule: Schedule = (ms, run) => {
  const handle = setTimeout(run, ms);
  return () => clearTimeout(handle);
};

export interface PlayersOptions {
  readonly speed: number;
  readonly auto: boolean;
  readonly schedule?: Schedule;
}

export interface PollResult {
  readonly events: readonly ApiEvent[];
  readonly proposals: readonly ProposalView[];
  readonly notes: readonly string[];
  readonly reset: boolean;
}

const castName = (proposal: ProposalView | undefined, castId: string): string =>
  proposal?.reviewers.find((reviewer) => reviewer.stakeholderId === castId)
    ?.name ?? castId;

export class Players {
  private readonly api: Api;
  private readonly schedule: Schedule;
  private speed: number;
  private auto: boolean;
  private epoch: number | undefined;
  private cursor: number | undefined;
  private rounds = new Map<string, number>();
  private planned = new Set<string>();
  private noticed = new Set<string>();
  private cancels = new Set<() => void>();
  private pendingNotes: string[] = [];
  private latest: readonly ProposalView[] = [];

  constructor(api: Api, options: PlayersOptions) {
    this.api = api;
    this.speed = options.speed;
    this.auto = options.auto;
    this.schedule = options.schedule ?? timerSchedule;
  }

  setMode(options: { speed?: number; auto?: boolean }): void {
    if (options.speed !== undefined) this.speed = options.speed;
    if (options.auto !== undefined) this.auto = options.auto;
  }

  stop(): void {
    for (const cancel of this.cancels) cancel();
    this.cancels.clear();
  }

  private clear(): void {
    this.stop();
    this.rounds = new Map();
    this.planned = new Set();
    this.noticed = new Set();
  }

  private async pullEvents(): Promise<{ events: ApiEvent[]; reset: boolean }> {
    const collected: ApiEvent[] = [];
    let reset = false;
    for (;;) {
      const page = await this.api.events(this.cursor ?? 0, this.epoch);
      if (
        page.reset ||
        (this.epoch !== undefined && page.epoch !== this.epoch)
      ) {
        reset = true;
        this.clear();
        collected.length = 0;
      }
      this.epoch = page.epoch;
      if (page.reset) {
        this.cursor = 0;
        continue;
      }
      this.cursor = page.cursor;
      for (const event of page.events) {
        collected.push(event);
        if (event.kind === 'proposal.reopened') {
          const id = event.refs?.['proposalId'];
          if (typeof id === 'string') {
            this.rounds.set(id, (this.rounds.get(id) ?? 0) + 1);
          }
        }
      }
      if (page.events.length < 200) break;
    }
    return { events: collected, reset };
  }

  async poll(): Promise<PollResult> {
    const { events, reset } = await this.pullEvents();
    const [proposals, room] = await Promise.all([
      this.api.proposals(),
      this.api.room(),
    ]);
    this.latest = proposals;
    const humans = new Set(
      room.cast
        .filter(
          (member) => member.occupied === true || member.occupant === 'human',
        )
        .map((member) => member.id),
    );
    for (const vote of planVotes({
      proposals,
      humans,
      rounds: this.rounds,
      planned: this.planned,
      speed: this.speed,
    })) {
      this.planned.add(vote.key);
      this.arm(vote.delayMs, () => this.castVote(vote, proposals));
    }
    if (this.auto) {
      for (const reopen of planReopens({
        proposals,
        rounds: this.rounds,
        planned: this.planned,
        speed: this.speed,
        authorHeld: humans.has(AUTHOR_ID),
      })) {
        this.planned.add(reopen.key);
        this.arm(reopen.delayMs, () => this.castReopen(reopen));
      }
    } else {
      for (const proposal of proposals) {
        const notice = disputeNotice(proposal, this.rounds);
        if (notice && !this.noticed.has(notice.key)) {
          this.noticed.add(notice.key);
          this.pendingNotes.push(notice.text);
        }
      }
    }
    const notes = this.pendingNotes;
    this.pendingNotes = [];
    return { events, proposals, notes, reset };
  }

  private arm(delayMs: number, run: () => Promise<void>): void {
    const cancel = this.schedule(delayMs, () => {
      this.cancels.delete(cancel);
      void run();
    });
    this.cancels.add(cancel);
  }

  private async castVote(
    vote: PlannedVote,
    proposals: readonly ProposalView[],
  ): Promise<void> {
    const who = castName(
      proposals.find((proposal) => proposal.id === vote.proposalId),
      vote.castId,
    );
    try {
      await this.api.vote({
        notificationId: vote.notificationId,
        kind: vote.kind,
        note: vote.note,
        actAs: vote.castId,
        actionId: actionIdOf([vote.notificationId, vote.kind, vote.note]),
      });
    } catch (error) {
      if (isSeatHeld(error)) {
        this.pendingNotes.push(
          `${who} la juega una persona: no voto por ella.`,
        );
        return;
      }
      if (error instanceof ApiError) {
        this.pendingNotes.push(`El voto de ${who} no entró: ${error.message}`);
        return;
      }
      throw error;
    }
  }

  private async castReopen(reopen: PlannedReopen): Promise<void> {
    try {
      await this.api.reopen(reopen.proposalId);
    } catch (error) {
      if (error instanceof ApiError) {
        this.pendingNotes.push(`No pude reabrir: ${error.message}`);
        return;
      }
      throw error;
    }
  }

  async reopenDisputed(): Promise<number> {
    const proposals = await this.api.proposals();
    const disputed = proposals.filter(
      (proposal) => proposal.status === 'disputed',
    );
    for (const proposal of disputed) await this.api.reopen(proposal.id);
    return disputed.length;
  }

  hasActive(proposals: readonly ProposalView[] = this.latest): boolean {
    return proposals.some((proposal) => isActiveStatus(proposal.status));
  }

  hasPendingWork(): boolean {
    return this.cancels.size > 0;
  }
}
