import { diffEvents, type Observed } from '../../../src/modules/room/events.ts';

const observed = (overrides: Partial<Observed>): Observed => ({
  sealed: false,
  version: 1,
  proposals: new Map(),
  overlaps: new Map(),
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

  it('emite el solapamiento nuevo con quienes validan y sus cambios de estado', () => {
    const overlap = (
      status: 'abierto' | 'confirmado' | 'descartado' | 'resuelto',
    ) => ({
      status,
      title: 'Shaft S1 y Colector B2 · nivel 3 · C-D/3 · sanitarias',
      validators: ['fernanda-lagos', 'javier-munoz'],
    });
    const none = observed({});
    const detected = observed({
      overlaps: new Map([['o1', overlap('abierto')]]),
    });
    const opened = diffEvents(none, detected);
    expect(opened.map((event) => event.kind)).toEqual(['overlap.detected']);
    expect(opened[0]?.message).toContain('nivel 3 · C-D/3 · sanitarias');
    expect(opened[0]?.message).toContain('Fernanda Lagos y Javier Muñoz');
    expect(opened[0]?.refs).toEqual({
      overlapId: 'o1',
      castIds: ['fernanda-lagos', 'javier-munoz'],
    });

    const next = (status: 'confirmado' | 'descartado' | 'resuelto') =>
      diffEvents(
        detected,
        observed({ overlaps: new Map([['o1', overlap(status)]]) }),
      ).map((event) => event.kind);
    expect(next('confirmado')).toEqual(['overlap.confirmed']);
    expect(next('descartado')).toEqual(['overlap.cleared']);
    expect(next('resuelto')).toEqual(['overlap.resolved']);

    const confirmed = observed({
      overlaps: new Map([['o1', overlap('confirmado')]]),
    });
    expect(
      diffEvents(
        confirmed,
        observed({ overlaps: new Map([['o1', overlap('resuelto')]]) }),
      ).map((event) => event.kind),
    ).toEqual(['overlap.resolved']);
    expect(diffEvents(confirmed, confirmed)).toEqual([]);
  });
});
