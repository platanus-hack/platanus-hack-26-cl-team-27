import { Session } from '../src/cli/session.ts';
import { findPaso } from '../src/guion.ts';
import { Api } from '../src/load/api.ts';
import { indexByPath, readLake } from '../src/pipeline.ts';
import { Players } from '../src/players/players.ts';

const items = indexByPath(readLake());

const fakeApi = () => {
  const state: { proposals: unknown[]; overlaps: unknown[] } = {
    proposals: [],
    overlaps: [],
  };
  const loaded: { documentId: string; label: string }[] = [];
  const requests: string[] = [];
  let empty = true;
  const http = (async (url: string, init: RequestInit) => {
    const path = url.replace('http://api.test/api', '');
    const method = init.method ?? 'GET';
    requests.push(`${method} ${path.split('?')[0]}`);
    const body =
      init.body === undefined ? undefined : JSON.parse(String(init.body));
    if (path === '/spaces') {
      const byDocument = new Map<string, { label: string }[]>();
      for (const rev of loaded) {
        byDocument.set(rev.documentId, [
          ...(byDocument.get(rev.documentId) ?? []),
          { label: rev.label },
        ]);
      }
      return Response.json({
        spaces: [
          {
            id: 's',
            name: 'S',
            documents: [...byDocument].map(([id, revisions]) => ({
              id,
              title: id,
              state: 'current',
              revisions,
            })),
          },
        ],
      });
    }
    if (path === '/room') {
      return Response.json({
        epoch: 1,
        cast: [],
        lake: { empty },
        counters: {
          openProposals: 0,
          openDiscrepancies: 0,
          stale: 0,
          upToDate: 0,
          documents: loaded.length,
        },
        totals: { costDelta: 0, delayDays: 0, projectDays: 108 },
        projectVersion: 1,
      });
    }
    if (path === '/proposals')
      return Response.json({ proposals: state.proposals });
    if (path === '/overlaps')
      return Response.json({ overlaps: state.overlaps });
    if (path.startsWith('/events'))
      return Response.json({ epoch: 1, cursor: 0, reset: false, events: [] });
    if (path === '/lake/seed') {
      empty = false;
      for (const rev of body.revisions)
        loaded.push({ documentId: rev.documentId, label: rev.label });
      return Response.json({});
    }
    if (path === '/revisions') {
      loaded.push({ documentId: body.documentId, label: body.label });
      return Response.json({
        revisionId: 'r',
        claims: [],
        proposals: [],
        discrepancies: [],
        backed: [],
        stale: [],
      });
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  return {
    api: new Api({ apiUrl: 'http://api.test', presenterKey: 'k' }, http),
    requests,
    loaded,
    state,
  };
};

const session = () => {
  const fake = fakeApi();
  const lines: string[] = [];
  const players = new Players(fake.api, { speed: 4, auto: true });
  const instance = new Session({
    api: fake.api,
    items,
    players,
    out: (line) => lines.push(line),
    sleep: async () => undefined,
  });
  return { ...fake, lines, instance };
};

describe('sesión del guion', () => {
  it('la carga inicial siembra las diez revisiones por /lake/seed', async () => {
    const { instance, requests, loaded } = session();
    await instance.ensureSeeded();
    expect(requests).toContain('POST /lake/seed');
    expect(loaded).toHaveLength(10);
  });

  it('respeta el orden del guion: s2 pide antes E-102 rev C', async () => {
    const { instance, requests, lines } = session();
    await instance.ensureSeeded();
    const outcome = await instance.runPaso(findPaso('s2')!);
    expect(outcome).toBe('bloqueado');
    expect(requests).not.toContain('POST /revisions');
    expect(lines.join('\n')).toContain('Antes hay que cargar e102 rev C');
  });

  it('carga un paso por /revisions y no repite uno ya cargado', async () => {
    const { instance, requests, lines } = session();
    await instance.ensureSeeded();
    expect(await instance.runPaso(findPaso('s1')!)).toBe('cargado');
    expect(
      requests.filter((request) => request === 'POST /revisions'),
    ).toHaveLength(1);
    expect(await instance.runPaso(findPaso('s1')!)).toBe('ya-estaba');
    expect(lines.join('\n')).toContain(
      'Extraje drive-proyecto/E-102_revC.json: e102 rev C, 5 hechos.',
    );
  });

  it('el modo automático recorre todo el guion en orden', async () => {
    const { instance, loaded } = session();
    await instance.ensureSeeded();
    const outcome = await instance.runAuto(4);
    expect(outcome).toBe('cargado');
    expect(
      loaded.slice(10).map((rev) => `${rev.documentId} ${rev.label}`),
    ).toEqual([
      'e102 rev C',
      'presupuesto v3',
      'whatsapp mensaje 2',
      'a201 rev C',
      'libro folio 44',
      'a201 rev D',
      'is301 rev B',
      'q118 rev 2',
      'gantt v5',
      'eett03 rev B',
    ]);
    expect(await instance.nextPaso()).toBeNull();
  });

  it('un solapamiento confirmado deja asentar el paso si falta un paso posterior', async () => {
    const { instance, state } = session();
    state.overlaps = [
      {
        id: 'o1',
        proposalId: 'p',
        revisionId: 'r',
        chunkLocator: 'detalle shaft S1',
        kind: 'misma-area',
        area: { nivel: 'n3', celda: 'C-D/3', sistemas: ['sanitarias'] },
        subjectId: 'shaft-s1',
        otherSubjectId: 'colector-b2',
        otherBacking: { documentId: 'is301', label: 'rev A', ownerId: 'j' },
        status: 'confirmado',
        validators: ['fernanda-lagos', 'javier-munoz'],
        votes: [],
      },
    ];
    state.proposals = [
      {
        id: 'p',
        title: 'A-201 rev D',
        status: 'open',
        subjectId: 'shaft-s1',
        costDelta: 0,
        delayDays: 0,
        filtered: [],
        reviewers: [
          {
            stakeholderId: 'paula-rojas',
            name: 'Paula Rojas',
            notificationId: 'n',
            decision: 'approve',
            note: null,
          },
        ],
      },
    ];
    expect(await instance.settle(true)).toBe('listo');
  });
});
