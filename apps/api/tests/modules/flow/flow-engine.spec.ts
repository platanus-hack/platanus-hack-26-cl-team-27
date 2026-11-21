import {
  type MinuteInput,
  acceptProposal,
  recordPresence,
  rejectProposal,
  seedStore,
  submitMinute,
  viewStore,
} from '../../../src/modules/flow/flow-engine.ts';

const MINUTE: MinuteInput = {
  minuteId: 'm-1',
  source: 'sala',
  model: { title: 'LosAromos_EST', discipline: 'estructura' },
  changes: [
    {
      elementId: 'P-12',
      attribute: 'location',
      delta: { dx: 0, dy: 0.4, dz: 0 },
      reason: 'Alinear con el muro de corte M-6 y bajar la torsión',
    },
  ],
};

const NOW = new Date('2026-11-21T21:30:00Z');

const posted = () => {
  const store = seedStore(1);
  const outcome = submitMinute(store, 'paula-rojas', MINUTE, NOW);
  return { store, outcome };
};

const view = (store: ReturnType<typeof seedStore>) =>
  viewStore(store, new Set(), NOW.getTime());

const statusCode = (action: () => unknown): number | undefined => {
  try {
    action();
  } catch (error) {
    return (error as { getStatus(): number }).getStatus();
  }
  return undefined;
};

describe('flow engine', () => {
  it('la minuta de Paula genera un choque, una propuesta y los eventos en orden', () => {
    const { store, outcome } = posted();
    expect(outcome).not.toBe('replay');
    const kinds = (outcome as { events: { kind: string }[] }).events.map(
      (event) => event.kind,
    );
    expect(kinds).toEqual([
      'flow.minute.received',
      'flow.clash.detected',
      'flow.fix.proposed',
    ]);
    const state = view(store);
    expect(state.clash).toMatchObject({
      a: 'P-12',
      b: 'E-B-03',
      penetration: 0.25,
      axis: 'y',
      status: 'detectada',
    });
    expect(state.proposal).toMatchObject({
      elementId: 'E-B-03',
      ownerId: 'camila-vera',
      delta: { dx: 0, dy: 0.4, dz: 0 },
      segment: { fromX: 26, toX: 32 },
      clearanceAfter: 0.15,
      status: 'propuesta',
      cost: { total: 161500, currency: 'CLP', vat: false },
      schedule: { days: 0.5, critical: false },
    });
    expect(state.proposal?.checks.every((check) => check.ok)).toBe(true);
    expect(state.proposal?.checks.map((check) => check.label)).toEqual([
      'P-12 (15 cm)',
      'Colector B2',
      'Cielo falso',
    ]);
  });

  it('los textos salen como en el contrato', () => {
    const { store, outcome } = posted();
    const state = view(store);
    expect(
      (outcome as { events: { message: string }[] }).events[0]?.message,
    ).toBe('Paula Rojas movió P-12 40 cm al norte (Nivel 3, eje B-6)');
    expect(state.change?.summary).toBe(
      'Cambio enviado: P-12 se movió 40 cm al norte (Nivel 3, eje B-6). Vigente encontró 1 equipo afectado: Instalaciones eléctricas (Camila Vera).',
    );
    expect(state.proposal?.texts.title).toBe(
      'El pilar P-12 se corrió 40 cm al norte y pisa tu bandeja del eje B',
    );
    expect(state.proposal?.texts.why).toContain('de y = 6,00 m a y = 6,40 m');
    expect(state.proposal?.texts.why).toContain('ocupa de 6,45 a 6,75 m');
    expect(state.proposal?.texts.why).toContain(
      'Antes pasaba a 15 cm del pilar; ahora el pilar la atraviesa 25 cm.',
    );
    expect(state.proposal?.texts.proposal).toBe(
      'Propuesta de Vigente: correr 40 cm al norte el tramo de 6 m de la bandeja E-B-03, entre x = 26,0 y 32,0 m, con dos quiebres de 45°. Queda a 15 cm del pilar, igual que antes.',
    );
    expect(state.proposal?.texts.cost).toBe(
      '$161.500 + IVA (6 m de reinstalación, 2 curvas, 5 consolas, 1 m de bandeja). Plazo: 0,5 día, no mueve la entrega.',
    );
  });

  it('solo el dueño del elemento publica la minuta', () => {
    const store = seedStore(1);
    expect(
      statusCode(() => submitMinute(store, 'camila-vera', MINUTE, NOW)),
    ).toBe(403);
    expect(store.change).toBeNull();
  });

  it('un elemento desconocido es 404', () => {
    const store = seedStore(1);
    const bad = {
      ...MINUTE,
      changes: [{ ...MINUTE.changes[0]!, elementId: 'X-1' }],
    };
    expect(statusCode(() => submitMinute(store, 'paula-rojas', bad, NOW))).toBe(
      404,
    );
  });

  it('es idempotente por minuteId y rechaza otro cambio con 409', () => {
    const { store } = posted();
    expect(submitMinute(store, 'paula-rojas', MINUTE, NOW)).toBe('replay');
    expect(
      statusCode(() =>
        submitMinute(store, 'paula-rojas', { ...MINUTE, minuteId: 'm-2' }, NOW),
      ),
    ).toBe(409);
  });

  it('un movimiento que no choca no abre propuesta', () => {
    const store = seedStore(1);
    const small = {
      ...MINUTE,
      changes: [{ ...MINUTE.changes[0]!, delta: { dx: 0, dy: -0.1, dz: 0 } }],
    };
    submitMinute(store, 'paula-rojas', small, NOW);
    expect(store.clash).toBeNull();
    expect(store.proposal).toBeNull();
  });

  it('solo Camila acepta; al aceptar el caso queda resuelto y la bandeja se mueve', () => {
    const { store } = posted();
    const id = store.proposal!.id;
    expect(
      statusCode(() => acceptProposal(store, id, 'paula-rojas', NOW)),
    ).toBe(403);
    const outcome = acceptProposal(store, id, 'camila-vera', NOW);
    expect(outcome.events.map((event) => event.kind)).toEqual([
      'flow.fix.accepted',
      'flow.fix.applied',
      'flow.resolved',
    ]);
    const state = view(store);
    expect(state.proposal).toMatchObject({
      status: 'resuelta',
      decidedBy: 'camila-vera',
      decidedByName: 'Camila Vera',
    });
    expect(state.proposal?.resolvedText).toMatch(
      /^Resuelto por Camila Vera a las \d\d:\d\d$/,
    );
    expect(state.proposal?.appliedText).toMatch(
      /^Aplicado en tu plano a las \d\d:\d\d$/,
    );
    expect(state.clash?.status).toBe('resuelta');
    const tray = state.elements.find((element) => element.id === 'E-B-03');
    expect(tray?.box.min[1]).toBe(6.85);
    expect(tray?.box.max[1]).toBe(7.15);
  });

  it('aceptar de nuevo es idempotente', () => {
    const { store } = posted();
    const id = store.proposal!.id;
    acceptProposal(store, id, 'camila-vera', NOW);
    expect(acceptProposal(store, id, 'camila-vera', NOW).events).toEqual([]);
    expect(view(store).proposal?.status).toBe('resuelta');
  });

  it('rechazar deja el motivo y cierra la propuesta', () => {
    const { store } = posted();
    const id = store.proposal!.id;
    const outcome = rejectProposal(
      store,
      id,
      'camila-vera',
      'Hay un ducto',
      NOW,
    );
    expect(outcome.events[0]?.kind).toBe('flow.fix.rejected');
    expect(view(store).proposal).toMatchObject({
      status: 'rechazada',
      rejectReason: 'Hay un ducto',
    });
    expect(
      statusCode(() => acceptProposal(store, id, 'camila-vera', NOW)),
    ).toBe(409);
  });

  it('la presencia de Camila sobre la propuesta emite un aviso una sola vez', () => {
    const { store } = posted();
    const first = recordPresence(
      store,
      'camila-vera',
      'propuesta',
      NOW.getTime(),
    );
    expect(first.events[0]).toMatchObject({
      kind: 'flow.presence',
      message: 'Camila Vera está revisando tu cambio',
    });
    expect(
      recordPresence(store, 'camila-vera', 'propuesta', NOW.getTime() + 5000)
        .events,
    ).toEqual([]);
    expect(
      recordPresence(store, 'paula-rojas', 'plano', NOW.getTime()).events,
    ).toEqual([]);
    const camila = viewStore(
      store,
      new Set(),
      NOW.getTime() + 5000,
    ).presence.find((item) => item.castId === 'camila-vera');
    expect(camila).toMatchObject({ online: true, viewing: 'propuesta' });
  });
});
