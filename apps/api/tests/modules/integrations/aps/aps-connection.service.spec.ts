import {
  ApsConnectionError,
  ApsConnectionService,
  IDLE_REFRESH_AFTER_MS,
  REFRESH_MARGIN_MS,
} from '../../../../src/modules/integrations/aps/aps-connection.service.ts';
import { GrantRejectedError } from '../../../../src/modules/integrations/aps/aps-oauth-client.ts';
import { STATE_TTL_MS } from '../../../../src/modules/integrations/aps/oauth-state.ts';
import { cipher, fakeClient, grant, MemoryVault, stateOf } from './fakes.ts';

const setup = () => {
  const clock = { now: 1_000_000 };
  const vault = new MemoryVault();
  const client = fakeClient();
  const service = new ApsConnectionService(vault, client, cipher(), {
    now: () => clock.now,
  });
  const connect = async (organizationId = 'aromos') => {
    const { url, nonce } = service.startAuthorization(organizationId, 'user-1');
    await service.completeAuthorization({
      state: stateOf(url),
      nonce,
      code: 'code-1',
      error: null,
    });
  };
  return { clock, vault, client, service, connect };
};

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApsConnectionError) return error.code;
    throw error;
  }
  return null;
};

describe('ApsConnectionService: conectar', () => {
  it('canjea el código y guarda los tokens, el usuario de Autodesk y quién conectó', async () => {
    const { vault, client, connect, service } = setup();
    await connect();
    expect(client.exchangeCode).toHaveBeenCalledWith('code-1');
    expect(client.profile).toHaveBeenCalledWith('access-1');
    const stored = vault.rows.get('aromos');
    expect(stored).toMatchObject({
      connectedById: 'user-1',
      autodeskUser: { id: 'autodesk-1', email: 'admin@aromos.cl' },
      scopes: ['data:read', 'account:read', 'user-profile:read'],
      tokens: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: new Date(1_000_000 + 3600_000),
      },
      status: 'active',
    });
    expect(await service.status('aromos')).toMatchObject({
      status: 'active',
      autodeskUser: { name: 'Fernanda Soto' },
      connectedById: 'user-1',
    });
    expect(JSON.stringify(await service.status('aromos'))).not.toContain(
      'access-1',
    );
    expect(await service.status('otra')).toBeNull();
  });

  it('rechaza un estado sin la cookie del navegador, con otro nonce o vencido', async () => {
    const { clock, service, vault, client } = setup();
    const { url, nonce } = service.startAuthorization('aromos', 'user-1');
    const state = stateOf(url);
    const base = { state, code: 'code-1', error: null };
    expect(
      await codeOf(service.completeAuthorization({ ...base, nonce: null })),
    ).toBe('invalid_state');
    expect(
      await codeOf(
        service.completeAuthorization({ ...base, nonce: `${nonce}x` }),
      ),
    ).toBe('invalid_state');
    expect(
      await codeOf(
        service.completeAuthorization({ ...base, state: 'v1.a.b.c', nonce }),
      ),
    ).toBe('invalid_state');
    clock.now += STATE_TTL_MS;
    expect(
      await codeOf(service.completeAuthorization({ ...base, nonce })),
    ).toBe('invalid_state');
    expect(client.exchangeCode).not.toHaveBeenCalled();
    expect(vault.rows.size).toBe(0);
  });

  it('distingue un acceso denegado, un código rechazado y APS caído', async () => {
    const { service, client } = setup();
    const start = () => {
      const { url, nonce } = service.startAuthorization('aromos', 'user-1');
      return { state: stateOf(url), nonce };
    };
    expect(
      await codeOf(
        service.completeAuthorization({
          ...start(),
          code: null,
          error: 'access_denied',
        }),
      ),
    ).toBe('access_denied');
    client.exchangeCode.mockRejectedValueOnce(new GrantRejectedError(400));
    expect(
      await codeOf(
        service.completeAuthorization({ ...start(), code: 'c', error: null }),
      ),
    ).toBe('code_rejected');
    client.exchangeCode.mockRejectedValueOnce(new Error('ECONNRESET'));
    expect(
      await codeOf(
        service.completeAuthorization({ ...start(), code: 'c', error: null }),
      ),
    ).toBe('aps_unavailable');
    client.exchangeCode.mockResolvedValueOnce({
      ...grant(9),
      refreshToken: null,
    });
    expect(
      await codeOf(
        service.completeAuthorization({ ...start(), code: 'c', error: null }),
      ),
    ).toBe('aps_unavailable');
  });
});

describe('ApsConnectionService: getValidAccessToken', () => {
  it('entrega el token guardado mientras falten más de 5 minutos para que venza', async () => {
    const { clock, client, connect, service } = setup();
    await connect();
    clock.now += 3600_000 - REFRESH_MARGIN_MS - 1;
    expect(await service.getValidAccessToken('aromos')).toBe('access-1');
    expect(client.refresh).not.toHaveBeenCalled();
  });

  it('renueva cerca del vencimiento y guarda el refresh token nuevo', async () => {
    const { clock, client, connect, service, vault } = setup();
    await connect();
    clock.now += 3600_000 - REFRESH_MARGIN_MS;
    expect(await service.getValidAccessToken('aromos')).toBe('access-2');
    expect(client.refresh).toHaveBeenCalledWith('refresh-1');
    expect(vault.rows.get('aromos')).toMatchObject({
      tokens: {
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        expiresAt: new Date(clock.now + 3600_000),
      },
      refreshedAt: new Date(clock.now),
    });
    expect(await service.getValidAccessToken('aromos')).toBe('access-2');
    expect(client.refresh).toHaveBeenCalledTimes(1);
  });

  it('renueva una sola vez si llegan pedidos a la par', async () => {
    const { clock, client, connect, service } = setup();
    await connect();
    clock.now += 3600_000;
    const tokens = await Promise.all([
      service.getValidAccessToken('aromos'),
      service.getValidAccessToken('aromos'),
      service.getValidAccessToken('aromos'),
    ]);
    expect(tokens).toEqual(['access-2', 'access-2', 'access-2']);
    expect(client.refresh).toHaveBeenCalledTimes(1);
  });

  it('conserva el refresh token si APS no entrega otro', async () => {
    const { clock, client, connect, service, vault } = setup();
    await connect();
    client.refresh.mockResolvedValueOnce({ ...grant(7), refreshToken: null });
    clock.now += 3600_000;
    expect(await service.getValidAccessToken('aromos')).toBe('access-7');
    expect(vault.rows.get('aromos')?.tokens?.refreshToken).toBe('refresh-1');
  });

  it('pide reconectar si Autodesk rechaza la renovación, y no vuelve a intentarlo', async () => {
    const { clock, client, connect, service, vault } = setup();
    await connect();
    client.refresh.mockRejectedValueOnce(new GrantRejectedError(400));
    clock.now += 3600_000;
    expect(await codeOf(service.getValidAccessToken('aromos'))).toBe(
      'reconnect_required',
    );
    expect(vault.rows.get('aromos')?.status).toBe('reconnect_required');
    expect(await codeOf(service.getValidAccessToken('aromos'))).toBe(
      'reconnect_required',
    );
    expect(client.refresh).toHaveBeenCalledTimes(1);
    await connect();
    expect(await service.getValidAccessToken('aromos')).toBe('access-2');
  });

  it('deja la conexión activa si APS está caído', async () => {
    const { clock, client, connect, service, vault } = setup();
    await connect();
    client.refresh.mockRejectedValueOnce(new Error('ETIMEDOUT'));
    clock.now += 3600_000;
    expect(await codeOf(service.getValidAccessToken('aromos'))).toBe(
      'aps_unavailable',
    );
    expect(vault.rows.get('aromos')?.status).toBe('active');
    expect(await service.getValidAccessToken('aromos')).toBe('access-2');
  });

  it('avisa si la organización no conectó su cuenta', async () => {
    const { service } = setup();
    expect(await codeOf(service.getValidAccessToken('aromos'))).toBe(
      'not_connected',
    );
  });
});

describe('ApsConnectionService: mantener y desconectar', () => {
  it('renueva las conexiones activas que llevan una semana sin renovarse', async () => {
    const { clock, client, connect, service, vault } = setup();
    await connect('aromos');
    clock.now += IDLE_REFRESH_AFTER_MS / 2;
    await connect('otra');
    clock.now += IDLE_REFRESH_AFTER_MS / 2 + 1;
    expect(await service.refreshIdle()).toBe(1);
    expect(client.refresh).toHaveBeenCalledWith('refresh-1');
    expect(vault.rows.get('aromos')?.tokens?.accessToken).toBe('access-3');
    expect(vault.rows.get('otra')?.tokens?.accessToken).toBe('access-2');
    client.refresh.mockRejectedValueOnce(new GrantRejectedError(401));
    clock.now += IDLE_REFRESH_AFTER_MS;
    expect(await service.refreshIdle()).toBe(0);
    expect(vault.rows.get('otra')?.status).toBe('reconnect_required');
    expect(vault.rows.get('aromos')?.status).toBe('active');
  });

  it('revoca el refresh token y borra la conexión, aunque la revocación falle', async () => {
    const { client, connect, service, vault } = setup();
    await connect();
    client.revoke.mockRejectedValueOnce(new Error('caído'));
    await service.disconnect('aromos');
    expect(client.revoke).toHaveBeenCalledWith('refresh-1');
    expect(vault.rows.size).toBe(0);
    await service.disconnect('aromos');
    expect(client.revoke).toHaveBeenCalledTimes(1);
  });
});
