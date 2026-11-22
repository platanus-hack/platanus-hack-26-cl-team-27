import { parseArgs } from '../src/cli/args.ts';
import { resolvePresenterKey } from '../src/carga/index.ts';
import {
  CargaUsageError,
  type CargaOptions,
  parseCargaArgs,
} from '../src/carga/options.ts';
import { meetsCriterion, requestsPerSecond } from '../src/carga/report.ts';
import type { CallOptions, Http } from '../src/carga/http.ts';
import { Pulse, pulseDelay } from '../src/carga/pulse.ts';
import { flowPhase, pickFreeSeat, seatPhase } from '../src/carga/scenarios.ts';
import { percentile, Tracker } from '../src/carga/stats.ts';

describe('opciones de carga', () => {
  it('trae los valores por defecto', () => {
    expect(parseCargaArgs([])).toEqual({
      clientes: 30,
      minutos: 5,
      escenario: 'caso',
      pulsos: 1,
      historial: false,
      ciclo: 60,
      espera: 10,
      base: 'http://localhost:3001/api',
      produccion: false,
      forzar: false,
      json: null,
    });
  });

  it('lee valores y banderas', () => {
    const options = parseCargaArgs([
      '--clientes',
      '10',
      '--minutos=1',
      '--escenario',
      'sala',
      '--pulsos',
      '2',
      '--historial',
      '--forzar',
      '--json',
      'informe.json',
    ]);
    expect(options).toMatchObject({
      clientes: 10,
      minutos: 1,
      escenario: 'sala',
      pulsos: 2,
      historial: true,
      forzar: true,
      json: 'informe.json',
    });
  });

  it('se niega ante una base remota sin --produccion', () => {
    expect(() =>
      parseCargaArgs(['--base', 'https://api.example.com/api']),
    ).toThrow('--produccion');
    expect(
      parseCargaArgs(['--base', 'https://api.example.com/api', '--produccion'])
        .produccion,
    ).toBe(true);
  });

  it('rechaza lo inválido', () => {
    expect(() => parseCargaArgs(['--clientes', '0'])).toThrow(CargaUsageError);
    expect(() => parseCargaArgs(['--escenario', 'x'])).toThrow(CargaUsageError);
    expect(() => parseCargaArgs(['--pulsos', '3'])).toThrow(CargaUsageError);
    expect(() => parseCargaArgs(['--espera', '11'])).toThrow(CargaUsageError);
    expect(() => parseCargaArgs(['--espera', '1.5'])).toThrow(CargaUsageError);
    expect(() => parseCargaArgs(['--rapido'])).toThrow(CargaUsageError);
    expect(() => parseCargaArgs(['--ciclo'])).toThrow('Falta el valor');
  });

  it('entra por el comando carga', () => {
    expect(parseArgs(['carga', '--clientes', '5'])).toMatchObject({
      name: 'carga',
      options: { clientes: 5 },
    });
  });

  it('la clave sale del entorno y solo es por defecto en local', () => {
    const local = parseCargaArgs([]);
    expect(resolvePresenterKey(local, {})).toBe('sala-los-aromos');
    expect(resolvePresenterKey(local, { PRESENTER_KEY: 'otra' })).toBe('otra');
    const remote: CargaOptions = {
      ...local,
      base: 'https://api.example.com/api',
      produccion: true,
    };
    expect(() => resolvePresenterKey(remote, {})).toThrow('PRESENTER_KEY');
  });
});

describe('medición', () => {
  it('calcula percentiles por rango', () => {
    const values = Array.from({ length: 100 }, (_, index) => index + 1);
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 99)).toBe(99);
    expect(percentile([], 50)).toBe(0);
  });

  it('mide la latencia hasta la primera vez que cada espectador ve la fase', () => {
    let now = 0;
    const tracker = new Tracker(() => now);
    tracker.open('propuesta', 'propuesta');
    tracker.observe(0, 'limpio');
    now = 500;
    tracker.observe(0, 'propuesta');
    now = 900;
    tracker.observe(0, 'propuesta');
    now = 2500;
    tracker.observe(1, 'propuesta');
    expect(tracker.seenCount()).toBe(2);
    tracker.close(3);
    const [action] = tracker.actions();
    expect(action).toMatchObject({
      action: 'propuesta',
      expected: 3,
      seen: 2,
      underLimit: 1,
      max: 2500,
    });
    expect(meetsCriterion(tracker.actions())).toBe(false);
  });

  it('cumple solo si todos lo ven en menos de 2 s', () => {
    let now = 0;
    const tracker = new Tracker(() => now);
    tracker.open('reinicio', 'limpio');
    now = 1999;
    tracker.observe(0, 'limpio');
    tracker.close(1);
    expect(meetsCriterion(tracker.actions())).toBe(true);
    expect(meetsCriterion([])).toBe(false);
  });
});

describe('sondeo y fases', () => {
  it('espacia los sondeos y hace backoff ante el error', () => {
    expect(pulseDelay(1000, 0, () => 0.5)).toBe(1000);
    expect(pulseDelay(1000, 0, () => 0)).toBe(850);
    expect(pulseDelay(1000, 0, () => 1)).toBe(1150);
    expect(pulseDelay(1000, 1)).toBe(2000);
    expect(pulseDelay(1000, 2)).toBe(3000);
    expect(pulseDelay(1000, 9)).toBe(3000);
    expect(pulseDelay(1000, 0, () => 0, true)).toBe(0);
    expect(pulseDelay(1000, 0, () => 0.999999, true)).toBe(100);
    expect(pulseDelay(1000, 1, () => 0.5, true)).toBe(2000);
  });

  it('lee la fase del caso', () => {
    expect(flowPhase({ change: null, proposal: null })).toBe('limpio');
    expect(flowPhase({ change: {}, proposal: null })).toBe('cambio');
    expect(flowPhase({ proposal: { status: 'resuelta' } })).toBe('resuelta');
  });

  it('lee el asiento y elige uno libre que no sea de los actores', () => {
    const room = {
      cast: [
        { id: 'paula-rojas', occupied: false },
        { id: 'fernanda-lagos', occupied: false },
        { id: 'pres', occupied: false, presenter: true },
        { id: 'ocupado', occupied: true },
        { id: 'javier', occupied: false, bot: true },
      ],
    };
    expect(pickFreeSeat(room)).toBe('javier');
    expect(seatPhase(room, 'ocupado')).toBe('ocupado');
    expect(seatPhase(room, 'javier')).toBe('libre');
    expect(seatPhase(room, 'nadie')).toBe('ausente');
  });
});

describe('peticiones por segundo', () => {
  it('divide las peticiones de /events por la duración', () => {
    const endpoints = [
      {
        endpoint: 'GET /events',
        count: 250,
        errors: {},
        p50: 0,
        p95: 0,
        p99: 0,
        max: 0,
      },
    ];
    expect(requestsPerSecond(endpoints, 'GET /events', 100)).toBe(2.5);
    expect(requestsPerSecond(endpoints, 'GET /flow', 100)).toBe(0);
    expect(requestsPerSecond(endpoints, 'GET /events', 0)).toBe(0);
  });
});

describe('pulso con espera larga', () => {
  const fakeHttp = (announce: boolean) => {
    const paths: string[] = [];
    const timeouts: (number | undefined)[] = [];
    const http = {
      call: (options: CallOptions) => {
        paths.push(options.path);
        timeouts.push(options.timeoutMs);
        return Promise.resolve({
          ok: true,
          status: 200,
          error: null,
          data: {
            epoch: 1,
            cursor: 3,
            reset: false,
            events: [],
            ...(announce ? { longPoll: true } : {}),
          },
        });
      },
    } as unknown as Http;
    return { http, paths, timeouts };
  };

  it('la primera petición sale sin wait y las siguientes con wait si la API lo anuncia', async () => {
    const { http, paths, timeouts } = fakeHttp(true);
    const pulse = new Pulse(http, 1000, null, 10);
    await pulse.tick();
    await pulse.tick();
    expect(paths).toEqual(['/events', '/events?after=3&epoch=1&wait=10']);
    expect(timeouts).toEqual([undefined, 20_000]);
  });

  it('sin anuncio de la API sigue con el sondeo corto', async () => {
    const { http, paths } = fakeHttp(false);
    const pulse = new Pulse(http, 1000, null, 10);
    await pulse.tick();
    await pulse.tick();
    expect(paths).toEqual(['/events', '/events?after=3&epoch=1']);
  });

  it('con espera 0 fuerza el sondeo corto aunque la API la anuncie', async () => {
    const { http, paths } = fakeHttp(true);
    const pulse = new Pulse(http, 1000, null, 0);
    await pulse.tick();
    await pulse.tick();
    expect(paths).toEqual(['/events', '/events?after=3&epoch=1']);
  });
});
