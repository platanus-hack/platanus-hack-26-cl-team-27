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

export const scaled = (ms: number, speed: number): number =>
  Math.max(0, Math.round(ms / speed));

export const delayFor = (castId: string): number =>
  BOT_DELAY_MS[castId] ?? 3000;

export interface BotVote {
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
}): BotVote => {
  const dispute = DISPUTES[input.castId];
  if (dispute && dispute.subjectId === input.subjectId) {
    return input.round === 0
      ? {
          kind: 'issue',
          note: dispute.note,
          delayMs: delayFor(input.castId),
        }
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
