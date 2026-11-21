import {
  CASE_ATTRIBUTE,
  caseSubject,
  clock,
} from '../../../src/scenario/caso-p12.ts';
import {
  type FlowStore,
  type MinuteInput,
  submitMinute,
} from '../../../src/modules/flow/flow-engine.ts';
import {
  approvalText,
  buildHistory,
} from '../../../src/modules/flow/flow-history.ts';
import {
  type Lake,
  loadStore,
  persistDecision,
  persistMinute,
  seedCase,
} from '../../../src/modules/flow/flow-lake.ts';
import { project } from '../../project.ts';
import { memoryLake } from './memory-lake.ts';

const MINUTE: MinuteInput = {
  minuteId: 'minuta-001',
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

const history = async (lake: Lake) => {
  const subjects = ['P-12', 'E-B-03'].map(caseSubject);
  const provenances = new Map(
    await Promise.all(
      subjects.map(
        async (subject) =>
          [
            subject,
            await lake.getProvenance.execute({
              subject,
              attribute: CASE_ATTRIBUTE,
            }),
          ] as const,
      ),
    ),
  );
  const chunks = await lake.ports.chunks.list();
  return buildHistory({
    epoch: 1,
    cast: project,
    provenances,
    proposals: await lake.ports.proposals.list(),
    revisions: await lake.ports.revisions.list(),
    texts: new Map(chunks.map((chunk) => [chunk.revisionId, chunk.text])),
  });
};

const posted = async (): Promise<{ lake: Lake; id: string }> => {
  const lake = memoryLake();
  await seedCase(lake);
  const store: FlowStore = await loadStore(lake, 1, project, new Map());
  submitMinute(store, 'paula-rojas', MINUTE, new Date());
  await persistMinute(lake, store, MINUTE);
  const fresh = await loadStore(lake, 1, project, new Map());
  return { lake, id: fresh.proposal?.id as string };
};

describe('historia del caso', () => {
  it('antes de decidir solo hay base y el pendiente espera a Camila', async () => {
    const { lake } = await posted();
    const [p12, tray] = (await history(lake)).elements;
    expect(p12?.entries).toHaveLength(1);
    expect(p12?.entries[0]).toMatchObject({
      current: true,
      kind: 'base',
      text: 'Valor inicial del modelo LosAromos_EST',
      document: 'LosAromos_EST base',
    });
    expect(p12?.link).toBe('/valor/caso.P-12/ubicacion_m');
    expect(p12?.pending).toMatchObject({
      status: 'propuesta',
      value: 'x 29.8..30.2 · y 6.1..6.7 · z 0..2.55',
      text: 'Pendiente de Camila Vera',
      awaiting: [{ id: 'camila-vera', name: 'Camila Vera' }],
    });
    expect(tray?.pending?.by).toEqual({ id: 'vigente', name: 'Vigente' });
  });

  it('tras aceptar hay dos entradas con quién aprobó y cuándo', async () => {
    const { lake, id } = await posted();
    await persistDecision(lake, 'accept', id, 'camila-vera');
    const [p12, tray] = (await history(lake)).elements;
    expect(p12?.pending).toBeNull();
    expect(p12?.entries.map((e) => e.kind)).toEqual(['minuta', 'base']);
    const current = p12?.entries[0];
    expect(current?.current).toBe(true);
    expect(current?.text).toBe(
      'Paula Rojas movió P-12 40 cm al norte (minuta minuta-001 de LosAromos_EST)',
    );
    expect(current?.source).toBe('sala');
    expect(current?.minuteId).toBe('minuta-001');
    expect(current?.approvedBy[0]).toMatchObject({
      id: 'camila-vera',
      name: 'Camila Vera',
    });
    const at = new Date(current?.approvedBy[0]?.at as string);
    expect(tray?.entries[0]?.text).toBe(
      `Vigente propuso correr 40 cm al norte el tramo de E-B-03; Camila Vera lo aprobó a las ${clock(at)}`,
    );
    expect(tray?.entries[0]?.by).toEqual({ id: 'vigente', name: 'Vigente' });
    expect(tray?.entries[1]).toMatchObject({
      kind: 'base',
      current: false,
      value: 'x 26..32 · y 6.45..6.75 · z 2.25..2.35',
    });
    expect(tray?.entries[1]?.until).toBeDefined();
  });

  it('tras rechazar el pendiente trae el motivo y lo vigente no cambia', async () => {
    const { lake, id } = await posted();
    await persistDecision(lake, 'reject', id, 'camila-vera', 'No hay espacio');
    const [p12, tray] = (await history(lake)).elements;
    expect(p12?.entries).toHaveLength(1);
    expect(tray?.pending).toMatchObject({
      status: 'rechazada',
      reason: 'No hay espacio',
      text: 'Rechazada por Camila Vera: No hay espacio',
      awaiting: [],
    });
  });

  it('el texto de aprobación lleva nombre y hora', () => {
    const at = new Date('2026-11-21T21:32:10Z');
    expect(approvalText('Camila Vera', at)).toBe(
      `Aprobó Camila Vera a las ${clock(at)}`,
    );
  });
});
