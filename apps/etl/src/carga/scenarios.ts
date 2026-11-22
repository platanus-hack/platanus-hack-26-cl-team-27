import { randomUUID } from 'node:crypto';

import { type Http, sleep } from './http.ts';
import type { CargaOptions } from './options.ts';
import {
  FLOW_INTERVAL_MS,
  Pulse,
  type PulseSeat,
  SALA_INTERVAL_MS,
} from './pulse.ts';
import type { Tracker } from './stats.ts';

export const AUTHOR = 'paula-rojas';
export const AFFECTED = 'camila-vera';
export const FERNANDA = 'fernanda-lagos';
export const STEP_MS = 10_000;
export const CYCLE_FLOOR_MS = 30_000;
export const PRESENCE_MS = 8000;

export class CargaAbort extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CargaAbort';
  }
}

export interface Context {
  readonly http: Http;
  readonly options: CargaOptions;
  readonly presenterKey: string;
  readonly tracker: Tracker;
  readonly signal: AbortSignal;
  readonly out: (line: string) => void;
}

type Json = Record<string, unknown>;

const asJson = (value: unknown): Json =>
  typeof value === 'object' && value !== null ? (value as Json) : {};

const asList = (value: unknown): Json[] =>
  Array.isArray(value) ? value.map(asJson) : [];

export const flowPhase = (data: unknown): string => {
  const state = asJson(data);
  if (state['proposal']) return String(asJson(state['proposal'])['status']);
  return state['change'] ? 'cambio' : 'limpio';
};

export const seatPhase = (data: unknown, castId: string): string => {
  const member = asList(asJson(data)['cast']).find(
    (entry) => entry['id'] === castId,
  );
  if (member === undefined) return 'ausente';
  return member['occupied'] === true ? 'ocupado' : 'libre';
};

export const buildMinute = (minuteId: string) => ({
  minuteId,
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
});

const claim = async (ctx: Context, castId: string): Promise<PulseSeat> => {
  const reply = await ctx.http.call({
    label: '/seats/:castId/claim',
    method: 'POST',
    path: `/seats/${castId}/claim`,
  });
  const token = asJson(reply.data)['token'];
  if (!reply.ok || typeof token !== 'string') {
    throw new CargaAbort(
      `No pude tomar el asiento ${castId} (${reply.error ?? 'sin token'}). Si hay alguien conectado, espera o usa --forzar.`,
    );
  }
  return { castId, token };
};

const release = async (ctx: Context, seat: PulseSeat): Promise<void> => {
  await ctx.http.call({
    label: '/seats/:castId',
    method: 'DELETE',
    path: `/seats/${seat.castId}`,
    seatToken: seat.token,
  });
};

const resetCase = (ctx: Context) =>
  ctx.http.call({
    label: '/flow/reset',
    method: 'POST',
    path: '/flow/reset',
    presenterKey: ctx.presenterKey,
    body: {},
  });

const waitFor = async (
  ctx: Context,
  expected: number,
  limitMs: number,
): Promise<void> => {
  const until = performance.now() + limitMs;
  while (
    !ctx.signal.aborted &&
    performance.now() < until &&
    ctx.tracker.seenCount() < expected
  ) {
    await sleep(50, ctx.signal);
  }
};

const cycles = async (
  ctx: Context,
  one: () => Promise<void>,
  floorMs: number,
): Promise<number> => {
  const startedAt = performance.now();
  const totalMs = ctx.options.minutos * 60_000;
  const cycleMs = ctx.options.ciclo * 1000;
  let count = 0;
  for (;;) {
    const cycleStart = performance.now();
    await one();
    count += 1;
    ctx.out(`  ciclo ${count} listo`);
    const next = cycleStart + cycleMs;
    if (ctx.signal.aborted || next - startedAt + floorMs > totalMs) break;
    await sleep(next - performance.now(), ctx.signal);
    if (ctx.signal.aborted) break;
  }
  const rest = startedAt + totalMs - performance.now();
  if (rest > 0) await sleep(rest, ctx.signal);
  return count;
};

const flowClient = async (
  ctx: Context,
  id: number,
  seat: PulseSeat | null,
  measured: boolean,
): Promise<void> => {
  const { http, options, tracker, signal } = ctx;
  if (measured) await sleep(Math.random() * 1000, signal);
  const history = async (): Promise<void> => {
    await http.call({ label: '/flow/history', path: '/flow/history' });
  };
  const main = new Pulse(http, FLOW_INTERVAL_MS, seat).run(async () => {
    const reply = await http.call({ label: '/flow', path: '/flow' });
    if (reply.ok && measured) tracker.observe(id, flowPhase(reply.data));
    if (options.historial && options.pulsos === 1) await history();
  }, signal);
  const tasks = [main];
  if (options.pulsos === 2) {
    tasks.push(new Pulse(http, FLOW_INTERVAL_MS, seat).run(history, signal));
  }
  await Promise.all(tasks);
};

const preflightCaso = async (ctx: Context): Promise<void> => {
  const [flow, room] = await Promise.all([
    ctx.http.call({ label: '/flow', path: '/flow' }),
    ctx.http.call({ label: '/room', path: '/room' }),
  ]);
  if (!flow.ok || !room.ok) {
    throw new CargaAbort(
      `No pude leer el estado de la sala (GET /flow: ${flow.error ?? 'ok'}, GET /room: ${room.error ?? 'ok'}).`,
    );
  }
  const state = asJson(flow.data);
  const reasons: string[] = [];
  const online = asList(state['presence']).filter(
    (entry) => entry['online'] === true,
  );
  if (online.length > 0) reasons.push(`hay ${online.length} conectados`);
  const seated = asList(asJson(room.data)['cast']).filter(
    (entry) => entry['occupied'] === true,
  );
  if (seated.length > 0) reasons.push(`hay ${seated.length} asientos tomados`);
  if (state['change'] || state['proposal'])
    reasons.push('el caso está abierto');
  if (reasons.length > 0 && !ctx.options.forzar) {
    throw new CargaAbort(
      `Me niego a correr: ${reasons.join(' y ')}. Espera a que la sala esté vacía y limpia, o pasa --forzar.`,
    );
  }
};

export const runCaso = async (ctx: Context): Promise<number> => {
  const { http, options, tracker, signal } = ctx;
  await preflightCaso(ctx);
  const seats: PulseSeat[] = [];
  const stop = new AbortController();
  const inner = AbortSignal.any([signal, stop.signal]);
  const innerCtx = { ...ctx, signal: inner };
  let presence: NodeJS.Timeout | null = null;
  try {
    const paula = await claim(ctx, AUTHOR);
    seats.push(paula);
    const camila = await claim(ctx, AFFECTED);
    seats.push(camila);
    ctx.out(
      `Asientos tomados: ${AUTHOR} y ${AFFECTED}. Lanzando ${options.clientes} espectadores.`,
    );
    const sendPresence = (): void => {
      void http.call({
        label: '/flow/presence',
        method: 'POST',
        path: '/flow/presence',
        seatToken: camila.token,
        body: { viewing: 'propuesta' },
      });
    };
    sendPresence();
    presence = setInterval(sendPresence, PRESENCE_MS);
    const clients = [
      flowClient(innerCtx, -1, paula, false),
      flowClient(innerCtx, -2, camila, false),
      ...Array.from({ length: options.clientes }, (_, id) =>
        flowClient(innerCtx, id, null, true),
      ),
    ];
    await sleep(1500, signal);
    const done = await cycles(
      ctx,
      async () => {
        tracker.open('propuesta', 'propuesta');
        const minute = await http.call({
          label: '/flow/minutes',
          method: 'POST',
          path: '/flow/minutes',
          seatToken: paula.token,
          body: buildMinute(`carga-${randomUUID()}`),
        });
        const proposal = asJson(asJson(minute.data)['proposal']);
        await sleep(STEP_MS, signal);
        tracker.close(options.clientes);
        if (signal.aborted) return;
        tracker.open('resuelto', 'resuelta');
        if (typeof proposal['id'] === 'string') {
          await http.call({
            label: '/flow/proposals/:id/accept',
            method: 'POST',
            path: `/flow/proposals/${proposal['id']}/accept`,
            seatToken: camila.token,
          });
        } else {
          ctx.out('  la minuta no devolvió propuesta: no hay nada que aceptar');
        }
        await sleep(STEP_MS, signal);
        tracker.close(options.clientes);
        if (signal.aborted) return;
        tracker.open('reinicio', 'limpio');
        await resetCase(ctx);
        await waitFor(ctx, options.clientes, STEP_MS);
        tracker.close(options.clientes);
      },
      CYCLE_FLOOR_MS,
    );
    stop.abort();
    await Promise.all(clients);
    return done;
  } finally {
    stop.abort();
    if (presence !== null) clearInterval(presence);
    await resetCase(ctx);
    for (const seat of seats) await release(ctx, seat);
  }
};

const SALA_FLOOR_MS = 12_000;
const SALA_LOADS = [
  ['/room', '/room'],
  ['/baseline', '/baseline'],
  ['/spaces', '/spaces'],
  ['/proposals?status=active', '/proposals'],
] as const;

export const pickFreeSeat = (room: unknown): string | null => {
  const member = asList(asJson(room)['cast']).find(
    (entry) =>
      entry['occupied'] !== true &&
      entry['present'] !== true &&
      entry['presenter'] !== true &&
      ![AUTHOR, AFFECTED, FERNANDA].includes(String(entry['id'])),
  );
  return member === undefined ? null : String(member['id']);
};

export const runSala = async (ctx: Context): Promise<number> => {
  const { http, options, tracker, signal } = ctx;
  const room = await http.call({ label: '/room', path: '/room' });
  if (!room.ok) {
    throw new CargaAbort(`No pude leer GET /room (${room.error}).`);
  }
  const busy = asList(asJson(room.data)['cast']).filter(
    (entry) => entry['occupied'] === true || entry['present'] === true,
  );
  if (busy.length > 0 && !options.forzar) {
    throw new CargaAbort(
      `Me niego a correr: hay ${busy.length} asientos con gente. Espera a que la sala esté vacía, o pasa --forzar.`,
    );
  }
  const castId = pickFreeSeat(room.data);
  if (castId === null) {
    throw new CargaAbort('No hay un asiento libre del elenco para tomar.');
  }
  const stop = new AbortController();
  const inner = AbortSignal.any([signal, stop.signal]);
  const held: { seat: PulseSeat | null } = { seat: null };
  const client = async (id: number): Promise<void> => {
    await sleep(Math.random() * 1000, inner);
    await new Pulse(http, SALA_INTERVAL_MS).run(async () => {
      const replies = await Promise.all(
        SALA_LOADS.map(([path, label]) => http.call({ label, path })),
      );
      const snapshot = replies[0];
      if (snapshot?.ok) {
        tracker.observe(id, seatPhase(snapshot.data, castId));
      }
    }, inner);
  };
  try {
    ctx.out(
      `Asiento del actor: ${castId}. Lanzando ${options.clientes} espectadores.`,
    );
    const clients = Array.from({ length: options.clientes }, (_, id) =>
      client(id),
    );
    await sleep(1500, signal);
    const done = await cycles(
      ctx,
      async () => {
        tracker.open('asiento tomado', 'ocupado');
        held.seat = await claim(ctx, castId);
        await sleep(STEP_MS / 2, signal);
        tracker.close(options.clientes);
        tracker.open('asiento soltado', 'libre');
        await release(ctx, held.seat);
        held.seat = null;
        await sleep(STEP_MS / 2, signal);
        tracker.close(options.clientes);
      },
      SALA_FLOOR_MS,
    );
    stop.abort();
    await Promise.all(clients);
    return done;
  } finally {
    stop.abort();
    if (held.seat !== null) await release(ctx, held.seat);
  }
};
