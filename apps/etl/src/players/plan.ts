import type { ProposalView, ReviewerView } from '../load/api.ts';

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export const BOT_DELAY_MS: Readonly<Record<string, number>> = {
  'paula-rojas': 2500,
  'daniela-soto': 3000,
  'marcos-fuentes': 3500,
  'javier-munoz': 4000,
  'ventanas-quillay': 4500,
  'camila-vera': 5000,
  'tomas-reyes': 6000,
  'fernanda-lagos': 1000,
};

export const REAPPROVAL_DELAY_MS = 3000;
export const PRESENTER_REOPEN_DELAY_MS = 4000;
export const SCENE_PAUSE_MS = 3000;
export const AUTHOR_ID = 'fernanda-lagos';

const DEFAULT_DELAY_MS = 3000;

export const scaled = (ms: number, speed: number): number =>
  Math.max(0, Math.round(ms / speed));

export const delayFor = (castId: string): number =>
  BOT_DELAY_MS[castId] ?? DEFAULT_DELAY_MS;

export interface VotePlan {
  readonly kind: 'reviewed' | 'issue';
  readonly note: string;
  readonly delayMs: number;
}

const APPROVAL_NOTES: Readonly<Record<string, string>> = {
  'paula-rojas': 'Revisado, sin observaciones.',
  'daniela-soto': 'Revisé las partidas y actualizo el presupuesto.',
  'marcos-fuentes': 'Conforme, lo coordino en obra.',
  'javier-munoz': 'Sin problema para las redes sanitarias.',
  'camila-vera': 'Conforme con las canalizaciones.',
  'tomas-reyes': 'Conforme con las terminaciones.',
  'ventanas-quillay': 'Conforme, ajusto la cotización.',
};

const DISPUTES: Readonly<
  Record<string, { subjectId: string; note: string; reapproval: string }>
> = {
  'paula-rojas': {
    subjectId: 'losa-n3',
    note: 'Necesito 2 días para recalcular las vigas y pilares que reciben la losa',
    reapproval: 'Recalculado, queda conforme',
  },
  'javier-munoz': {
    subjectId: 'shaft-s1',
    note: 'El shaft a 8,5 m cruza el colector de la bajada B2',
    reapproval: 'Resuelto el cruce con el colector, queda conforme',
  },
};

export const planVote = (input: {
  castId: string;
  subjectId: string;
  round: number;
}): VotePlan => {
  const dispute = DISPUTES[input.castId];
  if (dispute && dispute.subjectId === input.subjectId) {
    return input.round === 0
      ? { kind: 'issue', note: dispute.note, delayMs: delayFor(input.castId) }
      : {
          kind: 'reviewed',
          note: dispute.reapproval,
          delayMs: REAPPROVAL_DELAY_MS,
        };
  }
  return {
    kind: 'reviewed',
    note: APPROVAL_NOTES[input.castId] ?? 'Conforme.',
    delayMs: delayFor(input.castId),
  };
};

export const isActiveStatus = (status: string): boolean =>
  status === 'open' || status === 'disputed';

export interface PlannedVote {
  readonly key: string;
  readonly proposalId: string;
  readonly notificationId: string;
  readonly castId: string;
  readonly round: number;
  readonly kind: 'reviewed' | 'issue';
  readonly note: string;
  readonly delayMs: number;
}

export interface VoteContext {
  readonly proposals: readonly ProposalView[];
  readonly humans: ReadonlySet<string>;
  readonly rounds: ReadonlyMap<string, number>;
  readonly planned: ReadonlySet<string>;
  readonly speed: number;
}

export const voteKey = (
  proposalId: string,
  castId: string,
  round: number,
): string => `vote:${proposalId}:${castId}:${round}`;

export const planVotes = (context: VoteContext): PlannedVote[] => {
  const votes: PlannedVote[] = [];
  for (const proposal of context.proposals) {
    if (!isActiveStatus(proposal.status)) continue;
    const round = context.rounds.get(proposal.id) ?? 0;
    for (const reviewer of proposal.reviewers) {
      if (reviewer.decision !== null || reviewer.notificationId === null)
        continue;
      if (context.humans.has(reviewer.stakeholderId)) continue;
      const key = voteKey(proposal.id, reviewer.stakeholderId, round);
      if (context.planned.has(key)) continue;
      const plan = planVote({
        castId: reviewer.stakeholderId,
        subjectId: proposal.subjectId,
        round,
      });
      votes.push({
        key,
        proposalId: proposal.id,
        notificationId: reviewer.notificationId,
        castId: reviewer.stakeholderId,
        round,
        kind: plan.kind,
        note: plan.note,
        delayMs: scaled(plan.delayMs, context.speed),
      });
    }
  }
  return votes;
};

export const disputers = (proposal: ProposalView): ReviewerView[] =>
  proposal.reviewers.filter((reviewer) => reviewer.decision === 'dispute');

export interface PlannedReopen {
  readonly key: string;
  readonly proposalId: string;
  readonly delayMs: number;
}

export const planReopens = (input: {
  proposals: readonly ProposalView[];
  rounds: ReadonlyMap<string, number>;
  planned: ReadonlySet<string>;
  speed: number;
  authorHeld: boolean;
}): PlannedReopen[] => {
  if (input.authorHeld) return [];
  const reopens: PlannedReopen[] = [];
  for (const proposal of input.proposals) {
    if (proposal.status !== 'disputed') continue;
    const round = input.rounds.get(proposal.id) ?? 0;
    const key = `reopen:${proposal.id}:${round}`;
    if (input.planned.has(key)) continue;
    reopens.push({
      key,
      proposalId: proposal.id,
      delayMs: scaled(PRESENTER_REOPEN_DELAY_MS, input.speed),
    });
  }
  return reopens;
};

export const disputeNotice = (
  proposal: ProposalView,
  rounds: ReadonlyMap<string, number>,
): { key: string; text: string } | null => {
  if (proposal.status !== 'disputed') return null;
  const who = disputers(proposal);
  if (who.length === 0) return null;
  const round = rounds.get(proposal.id) ?? 0;
  const text = who
    .map(
      (reviewer) =>
        `${reviewer.name} disputó${reviewer.note ? `: «${reviewer.note}»` : ''}`,
    )
    .join(' · ');
  return {
    key: `notice:${proposal.id}:${round}`,
    text: `${text} — [o] reabrir`,
  };
};
