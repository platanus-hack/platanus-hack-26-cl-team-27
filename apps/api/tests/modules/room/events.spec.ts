import { diffEvents, type Observed } from '../../../src/modules/room/events.ts';

const observed = (overrides: Partial<Observed>): Observed => ({
  sealed: false,
  version: 1,
  proposals: new Map(),
  stale: new Map(),
  ...overrides,
});

describe('diffEvents', () => {
  it('no emite nada si nada cambió', () => {
    const state = observed({});
    expect(diffEvents(state, state)).toEqual([]);
  });

  it('emite la fusión, el desfase nuevo y el sello en ese orden', () => {
    const before = observed({
      proposals: new Map([['p1', { status: 'open', title: 'Losa' }]]),
    });
    const after = observed({
      sealed: true,
      version: 2,
      proposals: new Map([['p1', { status: 'merged', title: 'Losa' }]]),
      stale: new Map([
        [
          'r1',
          {
            title: 'Carta Gantt v4',
            ownerId: 'marcos-fuentes',
            revisionId: 'r1',
          },
        ],
      ]),
    });
    const events = diffEvents(before, after);
    expect(events.map((event) => event.kind)).toEqual([
      'proposal.merged',
      'stale.detected',
      'consensus.sealed',
    ]);
    expect(events[1]?.message).toContain('Marcos Fuentes');
    expect(events[2]?.message).toContain('versión 2');
  });

  it('emite el reemplazo y el retiro de propuestas activas', () => {
    const before = observed({
      proposals: new Map([
        ['p1', { status: 'disputed', title: 'A' }],
        ['p2', { status: 'open', title: 'B' }],
        ['p3', { status: 'merged', title: 'C' }],
      ]),
    });
    const after = observed({
      proposals: new Map([
        ['p1', { status: 'superseded', title: 'A' }],
        ['p2', { status: 'withdrawn', title: 'B' }],
        ['p3', { status: 'merged', title: 'C' }],
      ]),
    });
    expect(diffEvents(before, after).map((event) => event.kind)).toEqual([
      'proposal.replaced',
      'proposal.withdrawn',
    ]);
  });
});
