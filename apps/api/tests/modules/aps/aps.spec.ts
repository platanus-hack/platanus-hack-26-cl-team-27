import { join, relative } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticationClient } from '@aps_sdk/authentication';

import { setupApp } from '../../../src/app.setup.ts';
import { apiRoot } from '../../../src/common/api-root.ts';
import { ApsAuth, VIEWER_SCOPES } from '../../../src/modules/aps/aps-auth.ts';
import { ApsController } from '../../../src/modules/aps/aps.controller.ts';
import {
  APS_AUTH,
  MODELS_CATALOG_READER,
} from '../../../src/modules/aps/aps.tokens.ts';
import {
  CATALOG_PATH,
  disciplineOf,
  readCatalog,
  type ModelsCatalog,
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
  it('reconoce las disciplinas de Snowdon Towers', () => {
    expect(
      [
        'Snowdon Towers Sample Architectural.rvt',
        'Snowdon Towers Sample Site.rvt',
        'Snowdon Towers Sample Structural.rvt',
        'Snowdon Towers Sample Plumbing.rvt',
        'Snowdon Towers Sample HVAC.rvt',
        'Snowdon Towers Sample Electrical.rvt',
        'otro.rvt',
      ].map(disciplineOf),
    ).toEqual([
      'architectural',
      'site',
      'structural',
      'plumbing',
      'hvac',
      'electrical',
      'other',
    ]);
  });
});

describe('readCatalog', () => {
  it('lee el catálogo versionado de la carpeta models de la API', async () => {
    expect(relative(apiRoot(), CATALOG_PATH)).toBe(
      join('models', 'models.json'),
    );
    expect((await readCatalog())?.models.length).toBeGreaterThan(0);
  });

  it('da null si el catálogo no existe', async () => {
    expect(
      await readCatalog(join(apiRoot(), 'models', 'no-existe.json')),
    ).toBeNull();
  });
});

describe('ApsController', () => {
  const catalog: ModelsCatalog = {
    bucketKey: 'b',
    region: 'US',
    models: [
      {
        file: 'a.rvt',
        discipline: 'architectural',
        objectKey: 'a.rvt',
        size: 1,
        urn: 'urn-a',
        status: 'success',
        messages: [],
        updatedAt: '2026-11-21T00:00:00Z',
      },
      {
        file: 'e.rvt',
        discipline: 'electrical',
        objectKey: 'e.rvt',
        size: 1,
        urn: 'urn-e',
        status: 'failed',
        messages: ['error'],
        updatedAt: '2026-11-21T00:00:00Z',
      },
    ],
  };

  const start = async (auth: ApsAuth | null) => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ApsController],
      providers: [
        { provide: APS_AUTH, useValue: auth },
        { provide: MODELS_CATALOG_READER, useValue: async () => catalog },
      ],
    }).compile();
    const app: INestApplication = setupApp(
      moduleRef.createNestApplication({ logger: false }),
    );
    await app.listen(0);
    return { app, base: `${await app.getUrl()}/api/aps` };
  };

  it('entrega un token de solo lectura del visor y solo los modelos traducidos', async () => {
    const { client, getTwoLeggedToken } = fakeClient();
    const { app, base } = await start(
      new ApsAuth({ clientId: 'id', clientSecret: 's' }, { client }),
    );
    try {
      const token = await fetch(`${base}/viewer-token`);
      expect(token.status).toBe(200);
      expect(token.headers.get('cache-control')).toBe('no-store');
      expect(await token.json()).toMatchObject({ access_token: 'tok' });
      expect(getTwoLeggedToken).toHaveBeenCalledWith('id', 's', [
        'viewables:read',
      ]);
      const models = await fetch(`${base}/models`);
      expect(await models.json()).toEqual({
        models: [{ file: 'a.rvt', discipline: 'architectural', urn: 'urn-a' }],
      });
    } finally {
      await app.close();
    }
  });

  it('responde 503 aps_not_configured sin credenciales', async () => {
    const { app, base } = await start(null);
    try {
      const response = await fetch(`${base}/viewer-token`);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: 'aps_not_configured',
      });
    } finally {
      await app.close();
    }
  });
});
