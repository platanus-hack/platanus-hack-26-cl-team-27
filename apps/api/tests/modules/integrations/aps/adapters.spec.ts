import type { AuthenticationClient } from '@aps_sdk/authentication';
import type { PrismaClient } from '@team27/data-main';

import {
  GrantRejectedError,
  SdkApsOAuthClient,
} from '../../../../src/modules/integrations/aps/aps-oauth-client.ts';
import { PrismaTokenVault } from '../../../../src/modules/integrations/aps/prisma-token-vault.ts';
import { TokenCipher } from '../../../../src/modules/integrations/aps/token-cipher.ts';
import { cipher } from './fakes.ts';

type Row = Record<string, unknown> & { organizationId: string };

const fakePrisma = () => {
  const rows = new Map<string, Row>();
  const apsConnection = {
    findUnique: vi.fn(
      async ({ where }: { where: { organizationId: string } }) =>
        rows.get(where.organizationId) ?? null,
    ),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { organizationId: string };
        create: Row;
        update: Record<string, unknown>;
      }) => {
        const previous = rows.get(where.organizationId);
        rows.set(
          where.organizationId,
          previous
            ? { ...previous, ...update }
            : { createdAt: new Date(5), ...create },
        );
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { organizationId: string };
        data: Record<string, unknown>;
      }) => {
        const previous = rows.get(where.organizationId);
        if (!previous) throw new Error('no existe');
        rows.set(where.organizationId, { ...previous, ...data });
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { organizationId: string };
        data: Record<string, unknown>;
      }) => {
        const previous = rows.get(where.organizationId);
        if (previous) rows.set(where.organizationId, { ...previous, ...data });
      },
    ),
    deleteMany: vi.fn(
      async ({ where }: { where: { organizationId: string } }) => {
        rows.delete(where.organizationId);
      },
    ),
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: { status: string; refreshedAt: { lt: Date } };
      }) =>
        [...rows.values()]
          .filter(
            (row) =>
              row['status'] === where.status &&
              (row['refreshedAt'] as Date) < where.refreshedAt.lt,
          )
          .map((row) => ({ organizationId: row.organizationId })),
    ),
  };
  return {
    rows,
    prisma: { apsConnection } as unknown as Pick<PrismaClient, 'apsConnection'>,
  };
};

const connection = (organizationId: string, n: number) => ({
  organizationId,
  connectedById: 'user-1',
  autodeskUser: { id: 'autodesk-1', email: 'admin@aromos.cl', name: null },
  scopes: ['data:read', 'account:read'],
  tokens: {
    accessToken: `access-${n}`,
    refreshToken: `refresh-${n}`,
    expiresAt: new Date(3600_000),
  },
  refreshedAt: new Date(1_000),
});

describe('PrismaTokenVault', () => {
  it('guarda los tokens cifrados y los devuelve descifrados', async () => {
    const { rows, prisma } = fakePrisma();
    const vault = new PrismaTokenVault(prisma, cipher());
    await vault.save(connection('aromos', 1));
    const row = rows.get('aromos');
    expect(JSON.stringify(row)).not.toContain('access-1');
    expect(JSON.stringify(row)).not.toContain('refresh-1');
    expect(row).toMatchObject({
      scopes: 'data:read account:read',
      status: 'active',
      autodeskUserId: 'autodesk-1',
    });
    expect(await vault.find('aromos')).toEqual({
      ...connection('aromos', 1),
      status: 'active',
      createdAt: new Date(5),
    });
    expect(await vault.find('otra')).toBeNull();
  });

  it('reemplaza los tokens al renovar y lista las conexiones activas sin renovar', async () => {
    const { prisma } = fakePrisma();
    const vault = new PrismaTokenVault(prisma, cipher());
    await vault.save(connection('aromos', 1));
    await vault.save({
      ...connection('otra', 1),
      refreshedAt: new Date(9_000),
    });
    await vault.storeTokens(
      'aromos',
      {
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        expiresAt: new Date(7200_000),
      },
      new Date(2_000),
    );
    expect((await vault.find('aromos'))?.tokens).toEqual({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      expiresAt: new Date(7200_000),
    });
    expect(await vault.activeRefreshedBefore(new Date(5_000))).toEqual([
      'aromos',
    ]);
    await vault.markReconnectRequired('aromos');
    expect((await vault.find('aromos'))?.status).toBe('reconnect_required');
    expect(await vault.activeRefreshedBefore(new Date(10_000))).toEqual([
      'otra',
    ]);
    await vault.remove('aromos');
    expect(await vault.find('aromos')).toBeNull();
  });

  it('no acepta un token copiado de otra organización ni cifrado con otra clave', async () => {
    const { rows, prisma } = fakePrisma();
    const vault = new PrismaTokenVault(prisma, cipher());
    await vault.save(connection('aromos', 1));
    await vault.save(connection('otra', 2));
    rows.set('otra', {
      ...rows.get('otra'),
      organizationId: 'otra',
      accessTokenCiphertext: rows.get('aromos')?.['accessTokenCiphertext'],
    });
    expect(await vault.find('otra')).toMatchObject({
      tokens: null,
      status: 'reconnect_required',
    });
    const rotated = new PrismaTokenVault(
      prisma,
      new TokenCipher('d'.repeat(64)),
    );
    expect(await rotated.find('aromos')).toMatchObject({
      tokens: null,
      status: 'reconnect_required',
    });
  });
});

const sdk = () => {
  const client = {
    authorize: vi.fn(
      () => 'https://developer.api.autodesk.com/authentication/v2/authorize?x',
    ),
    getThreeLeggedToken: vi.fn(async () => ({
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3599,
    })),
    refreshToken: vi.fn(async () => ({
      access_token: 'a2',
      refresh_token: 'r2',
      expires_in: 3599,
    })),
    getUserInfo: vi.fn(async () => ({
      sub: 'u1',
      email: 'admin@aromos.cl',
      preferred_username: 'fsoto',
    })),
    revoke: vi.fn(async () => ({})),
  };
  return {
    client,
    oauth: new SdkApsOAuthClient(
      {
        clientId: 'id',
        clientSecret: 'secret',
        callbackUrl: 'http://localhost:3000/api/integrations/aps/callback',
      },
      client as unknown as AuthenticationClient,
    ),
  };
};

const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), {
    axiosError: { response: { status } },
  });

describe('SdkApsOAuthClient', () => {
  it('arma la URL de autorización con el callback, los scopes y el estado', () => {
    const { client, oauth } = sdk();
    oauth.authorizeUrl('v1.a.b.c');
    expect(client.authorize).toHaveBeenCalledWith(
      'id',
      'code',
      'http://localhost:3000/api/integrations/aps/callback',
      ['data:read', 'account:read', 'user-profile:read'],
      { state: 'v1.a.b.c' },
    );
  });

  it('canjea el código y renueva como cliente privado', async () => {
    const { client, oauth } = sdk();
    expect(await oauth.exchangeCode('code')).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 3599,
    });
    expect(client.getThreeLeggedToken).toHaveBeenCalledWith(
      'id',
      'code',
      'http://localhost:3000/api/integrations/aps/callback',
      { clientSecret: 'secret' },
    );
    expect(await oauth.refresh('r')).toMatchObject({ accessToken: 'a2' });
    expect(client.refreshToken).toHaveBeenCalledWith('r', 'id', {
      clientSecret: 'secret',
      scopes: ['data:read', 'account:read', 'user-profile:read'],
    });
  });

  it('traduce un 400 o 401 de APS a una autorización rechazada', async () => {
    const { client, oauth } = sdk();
    client.refreshToken.mockRejectedValueOnce(httpError(400));
    await expect(oauth.refresh('r')).rejects.toBeInstanceOf(GrantRejectedError);
    client.getThreeLeggedToken.mockRejectedValueOnce(httpError(401));
    await expect(oauth.exchangeCode('c')).rejects.toBeInstanceOf(
      GrantRejectedError,
    );
    client.refreshToken.mockRejectedValueOnce(httpError(503));
    await expect(oauth.refresh('r')).rejects.not.toBeInstanceOf(
      GrantRejectedError,
    );
  });

  it('pide el perfil con Bearer y revoca el refresh token', async () => {
    const { client, oauth } = sdk();
    expect(await oauth.profile('a')).toEqual({
      id: 'u1',
      email: 'admin@aromos.cl',
      name: 'fsoto',
    });
    expect(client.getUserInfo).toHaveBeenCalledWith('Bearer a');
    await oauth.revoke('r');
    expect(client.revoke).toHaveBeenCalledWith('r', 'id', 'refresh_token', {
      clientSecret: 'secret',
    });
  });
});
