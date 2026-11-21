import {
  Api,
  ApiError,
  type ApiEvent,
  type OverlapView,
  type ProposalView,
} from '../src/load/api.ts';
import { Players, type Schedule } from '../src/players/players.ts';

const reviewer = (
  id: string,
  name: string,
  decision: 'approve' | 'dispute' | null = null,
  note: string | null = null,
) => ({
  stakeholderId: id,
  name,
  notificationId: `n-${id}`,
  decision,
  note,
});

class FakeApi {
  proposalsNow: ProposalView[] = [];
  humans: string[] = [];
  epoch = 1;
  eventsNow: ApiEvent[] = [];
  votes: {
    notificationId: string;
    kind: string;
    note: string;
    actAs: string;
    actionId: string;
  }[] = [];
  reopens: string[] = [];
  heldFor = new Set<string>();

  async room() {
    return {
      epoch: this.epoch,
      cast: [
        {
          id: 'paula-rojas',
          name: 'Paula Rojas',
          occupied: this.humans.includes('paula-rojas'),
        },
        {
          id: 'daniela-soto',
          name: 'Daniela Soto',
          occupied: this.humans.includes('daniela-soto'),
        },
        { id: 'javier-munoz', name: 'Javier Muñoz', occupied: false },
        { id: 'fernanda-lagos', name: 'Fernanda Lagos', occupant: 'presenter' },
      ],
    };
  }

  async proposals() {
    return this.proposalsNow;
  }

  overlapsNow: OverlapView[] = [];
  overlapVotes: {
    overlapId: string;
    kind: string;
    note: string;
    actAs: string;
  }[] = [];

  async overlaps() {
    return this.overlapsNow;
  }

  async voteOverlap(input: {
    overlapId: string;
    kind: string;
    note: string;
    actAs: string;
  }) {
    if (this.heldFor.has(input.actAs)) {
      throw new ApiError(409, 'seat_held', 'la tiene una persona');
    }
    this.overlapVotes.push(input);
  }

  async events(after: number | undefined) {
    const events = this.eventsNow.filter((event) => event.seq > (after ?? 0));
    return {
      epoch: this.epoch,
      cursor: events.at(-1)?.seq ?? after ?? 0,
      reset: false,
      events,
    };
  }

  async vote(input: {
    notificationId: string;
    kind: string;
    note: string;
    actAs: string;
    actionId: string;
  }) {
    if (this.heldFor.has(input.actAs)) {
      throw new ApiError(409, 'seat_held', 'la tiene una persona');
    }
    this.votes.push(input);
  }

  async reopen(id: string) {
    this.reopens.push(id);
  }
}

const harness = (options: { auto: boolean; speed?: number }) => {
  const api = new FakeApi();
  const timers: { ms: number; run: () => void; live: boolean }[] = [];
  const schedule: Schedule = (ms, run) => {
    const timer = { ms, run, live: true };
    timers.push(timer);
    return () => {
      timer.live = false;
    };
  };
  const players = new Players(api as unknown as Api, {
    speed: options.speed ?? 1,
    auto: options.auto,
    schedule,
  });
  const fire = async () => {
    for (const timer of timers.filter((t) => t.live)) {
      timer.live = false;
      timer.run();
    }
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { api, players, timers, fire };
};

const slab = (
  status: string,
  decisions: Record<string, 'approve' | 'dispute' | null> = {},
): ProposalView => ({
  id: 'p1',
  title: 'Losa nivel 3',
  status,
  subjectId: 'losa-n3',
  costDelta: 0,
  delayDays: 0,
  filtered: [],
  reviewers: [
    reviewer(
      'paula-rojas',
      'Paula Rojas',
      decisions['paula-rojas'] ?? null,
      decisions['paula-rojas'] === 'dispute' ? 'Necesito 2 días' : null,
    ),
    reviewer('daniela-soto', 'Daniela Soto', decisions['daniela-soto'] ?? null),
    reviewer('javier-munoz', 'Javier Muñoz', decisions['javier-munoz'] ?? null),
  ],
});

describe('Players', () => {
  it('agenda los votos con el retardo de cada asiento y vota con su nota', async () => {
    const { api, players, timers, fire } = harness({ auto: true, speed: 2 });
    api.proposalsNow = [slab('open')];
    await players.poll();
    expect(timers.map((timer) => timer.ms).sort((a, b) => a - b)).toEqual([
      1250, 1500, 2000,
    ]);
    await fire();
    expect(api.votes.map((vote) => [vote.actAs, vote.kind])).toEqual([
      ['paula-rojas', 'issue'],
      ['daniela-soto', 'reviewed'],
      ['javier-munoz', 'reviewed'],
    ]);
    expect(api.votes[0]?.actionId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('no planifica dos veces el mismo voto', async () => {
    const { api, players, timers } = harness({ auto: true });
    api.proposalsNow = [slab('open')];
    await players.poll();
    await players.poll();
    expect(timers).toHaveLength(3);
  });

  it('no vota por un asiento con una persona', async () => {
    const { api, players, fire } = harness({ auto: true });
    api.humans = ['paula-rojas'];
    api.proposalsNow = [slab('open')];
    await players.poll();
    await fire();
    expect(api.votes.map((vote) => vote.actAs)).toEqual([
      'daniela-soto',
      'javier-munoz',
    ]);
  });

  it('si la API responde seat_held no insiste y lo avisa', async () => {
    const { api, players, fire } = harness({ auto: true });
    api.heldFor.add('daniela-soto');
    api.proposalsNow = [slab('open')];
    await players.poll();
    await fire();
    const next = await players.poll();
    expect(next.notes.join(' ')).toContain('Daniela Soto la juega una persona');
    await fire();
    expect(
      api.votes.filter((vote) => vote.actAs === 'daniela-soto'),
    ).toHaveLength(0);
  });

  it('en automático Fernanda reabre la disputa a los 4 s', async () => {
    const { api, players, timers, fire } = harness({ auto: true });
    api.proposalsNow = [
      slab('disputed', {
        'paula-rojas': 'dispute',
        'daniela-soto': 'approve',
        'javier-munoz': 'approve',
      }),
    ];
    await players.poll();
    expect(timers.map((timer) => timer.ms)).toEqual([4000]);
    await fire();
    expect(api.reopens).toEqual(['p1']);
  });

  it('en interactivo avisa la disputa una sola vez y no reabre sola', async () => {
    const { api, players, timers } = harness({ auto: false });
    api.proposalsNow = [
      slab('disputed', {
        'paula-rojas': 'dispute',
        'daniela-soto': 'approve',
        'javier-munoz': 'approve',
      }),
    ];
    const first = await players.poll();
    const second = await players.poll();
    expect(first.notes).toEqual([
      'Paula Rojas disputó: «Necesito 2 días» — [o] reabrir',
    ]);
    expect(second.notes).toEqual([]);
    expect(timers).toHaveLength(0);
    expect(await players.reopenDisputed()).toBe(1);
    expect(api.reopens).toEqual(['p1']);
  });

  it('cuenta las reaperturas de los eventos para pasar a la ronda siguiente', async () => {
    const { api, players, timers } = harness({ auto: true });
    api.eventsNow = [
      {
        seq: 1,
        kind: 'proposal.reopened',
        message: 'reabrió',
        refs: { proposalId: 'p1' },
      },
    ];
    api.proposalsNow = [
      slab('open', { 'daniela-soto': 'approve', 'javier-munoz': 'approve' }),
    ];
    const result = await players.poll();
    expect(result.events).toHaveLength(1);
    expect(timers.map((timer) => timer.ms)).toEqual([3000]);
  });

  it('detecta que no queda nada activo', async () => {
    const { api, players } = harness({ auto: true });
    api.proposalsNow = [slab('merged')];
    const result = await players.poll();
    expect(players.isBusy(false, result.proposals, [])).toBe(false);
    expect(players.hasPendingWork()).toBe(false);
  });

  it('vota el solapamiento del shaft y el colector, salvo los asientos con persona', async () => {
    const { api, players, fire } = harness({ auto: true });
    api.overlapsNow = [
      {
        id: 'o1',
        proposalId: 'p',
        revisionId: 'r',
        chunkLocator: 'detalle shaft S1',
        kind: 'misma-area',
        area: { nivel: 'n3', celda: 'C-D/3', sistemas: ['sanitarias'] },
        subjectId: 'shaft-s1',
        otherSubjectId: 'colector-b2',
        otherBacking: {
          documentId: 'is301',
          label: 'rev A',
          ownerId: 'javier-munoz',
        },
        status: 'abierto',
        validators: ['fernanda-lagos', 'javier-munoz'],
        votes: [],
      },
    ];
    api.heldFor.add('fernanda-lagos');
    const first = await players.poll();
    expect(first.notes.join('\n')).toContain(
      'Solapamiento: Shaft S1 y Colector B2 (IS-301 rev A) · nivel 3 · C-D/3 · sanitarias',
    );
    await fire();
    expect(api.overlapVotes).toEqual([
      expect.objectContaining({
        overlapId: 'o1',
        kind: 'se_tocan',
        note: 'El shaft a 8,5 m cruza el colector B2 en el nivel 3',
        actAs: 'javier-munoz',
      }),
    ]);
    const next = await players.poll();
    expect(next.notes.join('\n')).toContain(
      'Fernanda Lagos la juega una persona',
    );
    expect(players.isBusy(true)).toBe(true);
  });
});
