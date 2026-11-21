import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  SignJWT,
} from 'jose';

import {
  Auth0Identity,
  InvalidTokenError,
} from '../../../src/modules/accounts/identity.ts';

const DOMAIN = 'vigente.test.auth0.com';
const AUDIENCE = 'https://api.vigente.test';

const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
const keys = createLocalJWKSet({ keys: [jwk] });

const sign = (payload: JWTPayload, options: { expires?: string } = {}) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(`https://${DOMAIN}/`)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(options.expires ?? '5m')
    .sign(privateKey);

const identity = (fetcher: typeof fetch = fetch) =>
  new Auth0Identity({ domain: DOMAIN, audience: AUDIENCE }, keys, fetcher);

describe('Auth0Identity.verify', () => {
  it('acepta un token firmado por Auth0 para la API y entrega el sub', async () => {
    const token = await sign({ sub: 'email|abc' });
    await expect(identity().verify(token)).resolves.toEqual({
      subject: 'email|abc',
    });
  });

  it('rechaza un token para otra API', async () => {
    const token = await new SignJWT({ sub: 'email|abc' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(`https://${DOMAIN}/`)
      .setAudience('https://otra.api')
      .setExpirationTime('5m')
      .sign(privateKey);
    await expect(identity().verify(token)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('rechaza un token de otro emisor', async () => {
    const token = await new SignJWT({ sub: 'email|abc' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer('https://otro.auth0.com/')
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(privateKey);
    await expect(identity().verify(token)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('rechaza un token vencido', async () => {
    const token = await sign({ sub: 'email|abc' }, { expires: '-1m' });
    await expect(identity().verify(token)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('rechaza un token firmado con otra llave', async () => {
    const other = await generateKeyPair('RS256');
    const token = await new SignJWT({ sub: 'email|abc' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(`https://${DOMAIN}/`)
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(other.privateKey);
    await expect(identity().verify(token)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('rechaza un token sin sub', async () => {
    const token = await sign({});
    await expect(identity().verify(token)).rejects.toThrow(/sub/);
  });
});

describe('Auth0Identity.profile', () => {
  it('pide el perfil a /userinfo con el token y normaliza el correo', async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json({
          email: 'Paula.Rojas@Calculo.example',
          email_verified: true,
          name: 'Paula Rojas',
        }),
      ),
    );
    await expect(identity(fetcher).profile('tok')).resolves.toEqual({
      email: 'paula.rojas@calculo.example',
      emailVerified: true,
      name: 'Paula Rojas',
    });
    expect(fetcher).toHaveBeenCalledWith(`https://${DOMAIN}/userinfo`, {
      headers: { authorization: 'Bearer tok' },
    });
  });

  it('un perfil sin correo o una respuesta de error no sirven', async () => {
    const noEmail = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ name: 'x' })),
    );
    await expect(identity(noEmail).profile('tok')).rejects.toThrow(/correo/);
    const denied = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('no', { status: 401 })),
    );
    await expect(identity(denied).profile('tok')).rejects.toThrow(/401/);
  });
});
