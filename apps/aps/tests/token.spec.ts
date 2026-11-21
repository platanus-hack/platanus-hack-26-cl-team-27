import { tokenProvider } from '../src/token.ts';

const fakeAuth = () => {
  let issued = 0;
  const getTwoLeggedToken = vi.fn(async () => ({
    access_token: `tok-${++issued}`,
    expires_in: 3600,
  }));
  return { getTwoLeggedToken };
};

describe('tokenProvider', () => {
  const credentials = { clientId: 'id', clientSecret: 'secret' };

  it('reusa el token hasta un minuto antes de que venza', async () => {
    let now = 0;
    const client = fakeAuth();
    const provider = tokenProvider(credentials, ['data:read'], {
      client,
      now: () => now,
    });
    expect(await provider.getAccessToken()).toBe('tok-1');
    now = 3600_000 - 61_000;
    expect(await provider.getAccessToken()).toBe('tok-1');
    now = 3600_000 - 59_000;
    expect(await provider.getAccessToken()).toBe('tok-2');
    expect(client.getTwoLeggedToken).toHaveBeenCalledWith('id', 'secret', [
      'data:read',
    ]);
  });

  it('pide una sola vez si llegan pedidos a la par', async () => {
    const client = fakeAuth();
    const provider = tokenProvider(credentials, ['data:read'], { client });
    await Promise.all([provider.getAccessToken(), provider.getAccessToken()]);
    expect(client.getTwoLeggedToken).toHaveBeenCalledTimes(1);
  });
});
