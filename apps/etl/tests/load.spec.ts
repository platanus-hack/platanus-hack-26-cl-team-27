import { Api, ApiError, ApiUnreachable, isSeatHeld } from '../src/load/api.ts';
import {
  ingestRevision,
  revisionActionId,
  seedLake,
} from '../src/load/index.ts';
import type { Revision } from '../src/types.ts';

const revision: Revision = {
  documentId: 'e102',
  label: 'rev C',
  spaceId: 'drive-proyecto',
  authorId: 'fernanda-lagos',
  pointer: 'Drive/Los Aromos/Estructura/E-102_revC.pdf',
  contentHash: 'a'.repeat(64),
  chunks: [
    {
      locator: 'cuadro de losas rev C · Losa nivel 3',
      kind: 'fila',
      claims: [
        {
          subject: 'losa-n3',
          attribute: 'espesor_cm',
          value: 20,
          unit: 'cm',
          role: 'afirma',
          locator: 'cuadro de losas rev C · Losa nivel 3',
        },
      ],
    },
    {
      locator: 'folio 44',
      kind: 'anotacion',
      text: 'El shaft S1 se corre a 8,5 m del eje A.',
    },
  ],
};

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const fakeFetch = (respond: (call: Call) => Response) => {
  const calls: Call[] = [];
  const http = (async (url: string, init: RequestInit) => {
    const call: Call = {
      url,
      method: init.method ?? 'GET',
      headers: init.headers as Record<string, string>,
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
    };
    calls.push(call);
    return respond(call);
  }) as unknown as typeof fetch;
  return { calls, http };
};

const config = { apiUrl: 'http://api.test', presenterKey: 'clave' };

describe('carga a la API', () => {
  it('cada revisión va a POST /api/revisions con la clave y el dueño', async () => {
    const { calls, http } = fakeFetch(() =>
      Response.json({
        revisionId: 'r1',
        claims: [],
        proposals: [],
        discrepancies: [],
        backed: [],
        stale: [],
      }),
    );
    await ingestRevision(new Api(config, http), revision);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe('http://api.test/api/revisions');
    expect(call?.method).toBe('POST');
    expect(call?.headers['x-presenter-key']).toBe('clave');
    expect(call?.headers['x-act-as']).toBe('fernanda-lagos');
    expect(call?.headers['x-action-id']).toBe(revisionActionId(revision));
    expect(call?.body).toEqual({
      documentId: 'e102',
      label: 'rev C',
      spaceId: 'drive-proyecto',
      pointer: revision.pointer,
      contentHash: revision.contentHash,
      chunks: revision.chunks,
    });
  });

  it('el x-action-id es estable y distinto por documento y etiqueta', () => {
    expect(revisionActionId(revision)).toBe(revisionActionId({ ...revision }));
    expect(revisionActionId(revision)).not.toBe(
      revisionActionId({ ...revision, label: 'rev D' }),
    );
    expect(revisionActionId(revision)).not.toBe(
      revisionActionId({ ...revision, documentId: 'a201' }),
    );
  });

  it('la carga inicial va a POST /api/lake/seed con el autor de cada revisión y sin x-act-as', async () => {
    const { calls, http } = fakeFetch(() => Response.json({}));
    await seedLake(new Api(config, http), [revision]);
    const [call] = calls;
    expect(call?.url).toBe('http://api.test/api/lake/seed');
    expect(call?.headers['x-act-as']).toBeUndefined();
    expect(call?.headers['x-presenter-key']).toBe('clave');
    expect(call?.body).toEqual({
      revisions: [
        {
          documentId: 'e102',
          label: 'rev C',
          spaceId: 'drive-proyecto',
          pointer: revision.pointer,
          contentHash: revision.contentHash,
          chunks: revision.chunks,
          authorId: 'fernanda-lagos',
        },
      ],
    });
  });

  it('los fragmentos de texto viajan sin hechos y los estructurados con ellos', async () => {
    const { calls, http } = fakeFetch(() => Response.json({}));
    await ingestRevision(new Api(config, http), revision);
    const body = calls[0]?.body as {
      chunks: Record<string, unknown>[];
      claims?: unknown;
    };
    expect(body.claims).toBeUndefined();
    expect(Object.keys(body.chunks[0]!)).toEqual(['locator', 'kind', 'claims']);
    expect(body.chunks[1]).toEqual({
      locator: 'folio 44',
      kind: 'anotacion',
      text: 'El shaft S1 se corre a 8,5 m del eje A.',
    });
    expect('claims' in body.chunks[1]!).toBe(false);
  });

  it('el voto de un solapamiento usa la ruta del contrato', async () => {
    const { calls, http } = fakeFetch(() => Response.json({}));
    await new Api(config, http).voteOverlap({
      overlapId: 'o1',
      kind: 'se_tocan',
      note: 'cruza',
      actAs: 'javier-munoz',
      actionId: 'x',
    });
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('http://api.test/api/overlaps/o1/vote');
    expect(calls[0]?.headers['x-act-as']).toBe('javier-munoz');
    expect(calls[0]?.headers['x-action-id']).toBe('x');
    expect(calls[0]?.headers['x-presenter-key']).toBe('clave');
    expect(calls[0]?.body).toEqual({ kind: 'se_tocan', note: 'cruza' });
  });

  it('los solapamientos se leen de GET /api/overlaps', async () => {
    const { calls, http } = fakeFetch(() => Response.json({ overlaps: [] }));
    expect(await new Api(config, http).overlaps()).toEqual([]);
    expect(calls[0]?.url).toBe('http://api.test/api/overlaps');
  });

  it('el voto y la reapertura usan las rutas del contrato', async () => {
    const { calls, http } = fakeFetch(
      () => new Response(null, { status: 200 }),
    );
    const api = new Api(config, http);
    await api.vote({
      notificationId: 'n1',
      kind: 'issue',
      note: 'nota',
      actAs: 'paula-rojas',
      actionId: 'x',
    });
    await api.reopen('p1');
    await api.reset();
    expect(
      calls.map(
        (call) => `${call.method} ${call.url.replace('http://api.test', '')}`,
      ),
    ).toEqual([
      'POST /api/notifications/n1/response',
      'POST /api/proposals/p1/reopen',
      'POST /api/room/reset',
    ]);
    expect(calls[0]?.headers['x-act-as']).toBe('paula-rojas');
    expect(calls[0]?.body).toEqual({ kind: 'issue', note: 'nota' });
    expect(calls[1]?.headers['x-act-as']).toBeUndefined();
  });

  it('los eventos piden cursor y época', async () => {
    const { calls, http } = fakeFetch(() =>
      Response.json({ epoch: 2, cursor: 7, reset: false, events: [] }),
    );
    await new Api(config, http).events(5, 2);
    expect(calls[0]?.url).toBe(
      'http://api.test/api/events?limit=200&after=5&epoch=2',
    );
  });

  it('traduce los errores de la API', async () => {
    const { http } = fakeFetch(() =>
      Response.json(
        { code: 'seat_held', message: 'Paula la tiene una persona' },
        { status: 409 },
      ),
    );
    const error = await new Api(config, http)
      .reopen('p1')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(isSeatHeld(error)).toBe(true);
  });

  it('avisa claro si la API no responde', async () => {
    const http = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const error = await new Api(config, http).room().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiUnreachable);
    expect((error as Error).message).toContain('http://api.test');
  });
});
