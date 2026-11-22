import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticationClient } from '@aps_sdk/authentication';
import type { ModelDerivativeClient } from '@aps_sdk/model-derivative';
import type { OssClient } from '@aps_sdk/oss';

import { APP_OPTIONS, setupApp } from '../../../src/app.setup.ts';
import { ApsAuth, VIEWER_SCOPES } from '../../../src/modules/aps/aps-auth.ts';
import { ApsController } from '../../../src/modules/aps/aps.controller.ts';
import {
  APS_AUTH,
  MODELS_CATALOG,
} from '../../../src/modules/aps/aps.tokens.ts';
import {
  CATALOG_TTL_MS,
  disciplineOf,
  ModelsCatalog,
  toUrn,
  type ViewerModel,
} from '../../../src/modules/aps/models-catalog.ts';

const fakeClient = () => {
  const getTwoLeggedToken = vi.fn(async () => ({
    access_token: 'tok',
    expires_in: 3600,
  }));
  return {
    getTwoLeggedToken,
    client: { getTwoLeggedToken } as unknown as AuthenticationClient,
  };
};

describe('ApsAuth', () => {
  it('reusa el token mientras no esté por vencer', async () => {
    let now = 0;
    const { client, getTwoLeggedToken } = fakeClient();
    const auth = new ApsAuth(
      { clientId: 'id', clientSecret: 'secret' },
      { client, now: () => now },
    );
    await auth.getToken(VIEWER_SCOPES);
    now = 30 * 60_000;
    expect(await auth.getToken(VIEWER_SCOPES)).toEqual({
      access_token: 'tok',
      expires_in: 1800,
    });
    expect(getTwoLeggedToken).toHaveBeenCalledTimes(1);
    now = 3600_000 - 30_000;
    await auth.getToken(VIEWER_SCOPES);
    expect(getTwoLeggedToken).toHaveBeenCalledTimes(2);
  });

  it('pide una sola vez si llegan pedidos a la par y separa por scopes', async () => {
    const { client, getTwoLeggedToken } = fakeClient();
    const auth = new ApsAuth({ clientId: 'id', clientSecret: 's' }, { client });
    await Promise.all([
      auth.getToken(['viewables:read']),
      auth.getToken(['viewables:read']),
      auth.getToken(['data:read', 'bucket:read']),
    ]);
    expect(getTwoLeggedToken).toHaveBeenCalledTimes(2);
    expect(getTwoLeggedToken).toHaveBeenCalledWith('id', 's', [
      'viewables:read',
    ]);
  });
});

describe('disciplineOf', () => {
  it('reconoce las disciplinas de Snowdon Towers y del caso', () => {
    expect(
      [
        'Snowdon Towers Sample Architectural.rvt',
        'Snowdon Towers Sample Site.rvt',
        'Snowdon Towers Sample Structural.rvt',
        'Snowdon Towers Sample Plumbing.rvt',
        'Snowdon Towers Sample HVAC.rvt',
        'Snowdon Towers Sample Electrical.rvt',
        'caso-estructura.rvt',
        'caso-electrico.rvt',
        'otro.rvt',
      ].map(disciplineOf),
    ).toEqual([
      'architectural',
      'site',
      'structural',
      'plumbing',
      'hvac',
      'electrical',
      'structural',
      'electrical',
      'other',
    ]);
  });
});

const objectId = (file: string): string =>
  `urn:adsk.objects:os.object:b/${file}`;

const notFound = (): Error =>
  Object.assign(new Error('not found'), {
    axiosError: { response: { status: 404 } },
  });

const fakeBucket = (
  pages: Record<string, { files: string[]; next?: string }>,
  statuses: Record<string, string>,
) => {
  const getObjects = vi.fn(
    async (_bucketKey: string, args?: { startAt?: string }) => {
      const page = pages[args?.startAt ?? ''];
      if (!page) throw new Error(`página inesperada ${args?.startAt}`);
      return {
        items: page.files.map((file) => ({
          objectKey: file,
          objectId: objectId(file),
        })),
        ...(page.next ? { next: page.next } : {}),
      };
    },
  );
  const getManifest = vi.fn(async (urn: string) => {
    const file = Object.keys(statuses).find(
      (name) => toUrn(objectId(name)) === urn,
    );
    if (!file) throw notFound();
    return { status: statuses[file] };
  });
  return {
    getObjects,
    getManifest,
    clients: {
      oss: { getObjects } as unknown as Pick<OssClient, 'getObjects'>,
      derivatives: { getManifest } as unknown as Pick<
        ModelDerivativeClient,
        'getManifest'
      >,
    },
  };
};

describe('ModelsCatalog', () => {
  const snowdon = fakeBucket(
    {
      '': {
        files: ['Snowdon Electrical.rvt', 'caso-estructura.rvt'],
        next: 'https://developer.api.autodesk.com/oss/v2/buckets/b/objects?startAt=caso-estructura.rvt&limit=100',
      },
      'caso-estructura.rvt': {
        files: [
          'Snowdon Architectural.rvt',
          'en-curso.rvt',
          'sin-traducir.rvt',
        ],
      },
    },
    {
      'Snowdon Electrical.rvt': 'success',
      'caso-estructura.rvt': 'success',
      'Snowdon Architectural.rvt': 'success',
      'en-curso.rvt': 'inprogress',
    },
  );

  it('lista los modelos traducidos de todas las páginas del bucket, con disciplina y URN', async () => {
    const catalog = new ModelsCatalog('b', snowdon.clients);
    expect(await catalog.list()).toEqual<ViewerModel[]>([
      {
        file: 'caso-estructura.rvt',
        discipline: 'structural',
        urn: toUrn(objectId('caso-estructura.rvt')),
      },
      {
        file: 'Snowdon Architectural.rvt',
        discipline: 'architectural',
        urn: toUrn(objectId('Snowdon Architectural.rvt')),
      },
      {
        file: 'Snowdon Electrical.rvt',
        discipline: 'electrical',
        urn: toUrn(objectId('Snowdon Electrical.rvt')),
      },
    ]);
    expect(snowdon.getObjects).toHaveBeenLastCalledWith('b', {
      limit: 100,
      startAt: 'caso-estructura.rvt',
    });
  });

  it('guarda la lista en memoria hasta que vence', async () => {
    let now = 0;
    const bucket = fakeBucket(
      { '': { files: ['a.rvt'] } },
      { 'a.rvt': 'success' },
    );
    const catalog = new ModelsCatalog('b', bucket.clients, { now: () => now });
    await catalog.list();
    now = CATALOG_TTL_MS - 1;
    await catalog.list();
    expect(bucket.getObjects).toHaveBeenCalledTimes(1);
    now = CATALOG_TTL_MS + 1;
    await catalog.list();
    expect(bucket.getObjects).toHaveBeenCalledTimes(2);
  });

  it('pide una sola vez si llegan pedidos a la par', async () => {
    const bucket = fakeBucket(
      { '': { files: ['a.rvt'] } },
      { 'a.rvt': 'success' },
    );
    const catalog = new ModelsCatalog('b', bucket.clients);
    await Promise.all([catalog.list(), catalog.list()]);
    expect(bucket.getObjects).toHaveBeenCalledTimes(1);
  });

  it('no guarda un error de APS: el pedido siguiente vuelve a consultar', async () => {
    const bucket = fakeBucket(
      { '': { files: ['a.rvt'] } },
      { 'a.rvt': 'success' },
    );
    bucket.getObjects.mockRejectedValueOnce(new Error('APS caído'));
    const catalog = new ModelsCatalog('b', bucket.clients);
    await expect(catalog.list()).rejects.toThrow('APS caído');
    expect(await catalog.list()).toHaveLength(1);
  });
});

describe('ApsController', () => {
  const models: ViewerModel[] = [
    { file: 'a.rvt', discipline: 'architectural', urn: 'urn-a' },
  ];

  const start = async (
    auth: ApsAuth | null,
    catalog: Pick<ModelsCatalog, 'list'> | null,
  ) => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ApsController],
      providers: [
        { provide: APS_AUTH, useValue: auth },
        { provide: MODELS_CATALOG, useValue: catalog },
      ],
    }).compile();
    const app: INestApplication = setupApp(
      moduleRef.createNestApplication({ ...APP_OPTIONS, logger: false }),
    );
    await app.listen(0);
    return { app, base: `${await app.getUrl()}/api/aps` };
  };

  it('entrega un token de solo lectura del visor y los modelos traducidos', async () => {
    const { client, getTwoLeggedToken } = fakeClient();
    const { app, base } = await start(
      new ApsAuth({ clientId: 'id', clientSecret: 's' }, { client }),
      { list: async () => models },
    );
    try {
      const token = await fetch(`${base}/viewer-token`);
      expect(token.status).toBe(200);
      expect(token.headers.get('cache-control')).toBe('no-store');
      expect(await token.json()).toMatchObject({ access_token: 'tok' });
      expect(getTwoLeggedToken).toHaveBeenCalledWith('id', 's', [
        'viewables:read',
      ]);
      const response = await fetch(`${base}/models`);
      expect(await response.json()).toEqual({ models });
    } finally {
      await app.close();
    }
  });

  it('responde 503 aps_not_configured sin credenciales ni bucket', async () => {
    const { app, base } = await start(null, null);
    try {
      for (const path of ['viewer-token', 'models']) {
        const response = await fetch(`${base}/${path}`);
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({
          code: 'aps_not_configured',
        });
      }
    } finally {
      await app.close();
    }
  });

  it('responde 503 aps_unavailable si APS no entrega la lista', async () => {
    const { app, base } = await start(null, {
      list: () => Promise.reject(new Error('APS caído')),
    });
    try {
      const response = await fetch(`${base}/models`);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: 'aps_unavailable' });
    } finally {
      await app.close();
    }
  });
});
