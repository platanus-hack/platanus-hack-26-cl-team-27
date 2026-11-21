import {
  CASE_DOCUMENT_IDS,
  caseSubject,
} from '../../../src/scenario/caso-p12.ts';
import {
  type FlowStore,
  type MinuteInput,
  acceptProposal,
  rejectProposal,
  seedStore,
  submitMinute,
  viewStore,
} from '../../../src/modules/flow/flow-engine.ts';
import {
  type Lake,
  clearCase,
  loadStore,
  persistDecision,
  persistMinute,
  seedCase,
} from '../../../src/modules/flow/flow-lake.ts';
import { project } from '../../project.ts';
import { memoryLake } from './memory-lake.ts';

const minute = (
  minuteId: string,
  delta = { dx: 0, dy: 0.4, dz: 0 },
): MinuteInput => ({
  minuteId,
  source: 'sala',
  model: { title: 'LosAromos_EST', discipline: 'estructura' },
  changes: [
    {
      elementId: 'P-12',
      attribute: 'location',
      delta,
      reason: 'Alinear con el muro de corte M-6 y bajar la torsión',
    },
  ],
});

const load = (lake: Lake): Promise<FlowStore> =>
  loadStore(lake, 1, project, new Map());

const post = async (lake: Lake, input: MinuteInput) => {
  const store = await load(lake);
  const outcome = submitMinute(store, 'paula-rojas', input, new Date());
  if (outcome === 'replay') return 'replay' as const;
  await persistMinute(lake, store, input);
  return load(lake);
};

const status = (action: () => unknown): number | undefined => {
  try {
    action();
  } catch (error) {
    return (error as { getStatus(): number }).getStatus();
  }
  return undefined;
};

const seeded = async (): Promise<Lake> => {
  const lake = memoryLake();
  await seedCase(lake);
  return lake;
};

describe('flow sobre el lago', () => {
  it('sembrar el caso es idempotente y crea una revisión base por documento', async () => {
    const lake = await seeded();
    await seedCase(lake);
    const revisions = await lake.ports.revisions.list();
    expect(revisions.map((r) => r.documentId).sort()).toEqual(
      [...CASE_DOCUMENT_IDS].sort(),
    );
    expect(await lake.ports.baseline.list()).toHaveLength(4);
  });

  it('la minuta pendiente se rehidrata igual que el motor en memoria', async () => {
    const lake = await seeded();
    const memory = seedStore(1, project);
    submitMinute(memory, 'paula-rojas', minute('m-1'), new Date());
    const store = (await post(lake, minute('m-1'))) as FlowStore;
    expect(store.proposal?.status).toBe('propuesta');
    expect(store.elements.map((e) => e.box)).toEqual(
      memory.elements.map((e) => e.box),
    );
    expect(store.proposal?.texts).toEqual(memory.proposal?.texts);
    expect(store.change?.summary).toBe(memory.change?.summary);
    expect(store.clash?.status).toBe('detectada');
    const again = await load(lake);
    const view = (s: FlowStore) => JSON.stringify(viewStore(s, new Set(), 0));
    expect(view(again)).toBe(view(store));
    const baseline = await lake.ports.baseline.find(
      caseSubject('P-12'),
      'ubicacion_m',
    );
    expect(baseline?.value).toBe('x 29.8..30.2 · y 5.7..6.3 · z 0..2.55');
  });

  it('el mismo minuteId repite y otro da 409', async () => {
    const lake = await seeded();
    await post(lake, minute('m-1'));
    expect(await post(lake, minute('m-1'))).toBe('replay');
    const store = await load(lake);
    expect(
      status(() =>
        submitMinute(store, 'paula-rojas', minute('m-2'), new Date()),
      ),
    ).toBe(409);
  });

  it('aceptar fusiona en lo vigente y queda resuelta tras recargar', async () => {
    const lake = await seeded();
    const posted = (await post(lake, minute('m-1'))) as FlowStore;
    const id = posted.proposal?.id as string;
    const live = await load(lake);
    acceptProposal(live, id, 'camila-vera', new Date());
    await persistDecision(lake, 'accept', id, 'camila-vera');
    const store = await load(lake);
    expect(store.proposal?.status).toBe('resuelta');
    expect(store.clash?.status).toBe('resuelta');
    expect(store.proposal?.resolvedText).toMatch(
      /^Resuelto por Camila Vera a las \d{2}:\d{2}$/,
    );
    expect(store.proposal?.decidedBy).toBe('camila-vera');
    const tray = store.elements.find((e) => e.id === 'E-B-03');
    expect(tray?.box.min[1]).toBe(6.85);
    const history = await lake.ports.baseline.history(
      caseSubject('E-B-03'),
      'ubicacion_m',
    );
    expect(history).toHaveLength(1);
  });

  it('rechazar deja lo vigente y guarda el motivo', async () => {
    const lake = await seeded();
    const posted = (await post(lake, minute('m-1'))) as FlowStore;
    const id = posted.proposal?.id as string;
    const live = await load(lake);
    rejectProposal(live, id, 'camila-vera', 'No hay espacio', new Date());
    await persistDecision(lake, 'reject', id, 'camila-vera', 'No hay espacio');
    const store = await load(lake);
    expect(store.proposal?.status).toBe('rechazada');
    expect(store.proposal?.rejectReason).toBe('No hay espacio');
    const tray = await lake.ports.baseline.find(
      caseSubject('E-B-03'),
      'ubicacion_m',
    );
    expect(tray?.value).toBe('x 26..32 · y 6.45..6.75 · z 2.25..2.35');
  });

  it('una minuta sin choque se fusiona sola', async () => {
    const lake = await seeded();
    const store = (await post(
      lake,
      minute('m-1', { dx: 0, dy: -0.4, dz: 0 }),
    )) as FlowStore;
    expect(store.clash).toBeNull();
    expect(store.proposal).toBeNull();
    const p12 = await lake.ports.baseline.find(
      caseSubject('P-12'),
      'ubicacion_m',
    );
    expect(p12?.value).toBe('x 29.8..30.2 · y 5.3..5.9 · z 0..2.55');
    expect(p12?.version).toBe(2);
  });

  it('un choque sin arreglo deja la propuesta en null y noAutoFix', async () => {
    const lake = await seeded();
    const store = (await post(
      lake,
      minute('m-1', { dx: -24.5, dy: 0.3, dz: 0 }),
    )) as FlowStore;
    expect(store.clash?.noAutoFix).toBe(true);
    expect(store.proposal).toBeNull();
  });

  it('reiniciar el caso borra solo sus registros y resiembra', async () => {
    const lake = await seeded();
    await post(lake, minute('m-1'));
    await clearCase(lake);
    const store = await load(lake);
    expect(store.change).toBeNull();
    expect(await lake.ports.revisions.list()).toHaveLength(4);
    expect(await lake.ports.proposals.list()).toHaveLength(0);
    expect(
      await lake.ports.baseline.history(caseSubject('E-B-03'), 'ubicacion_m'),
    ).toHaveLength(0);
  });
});
