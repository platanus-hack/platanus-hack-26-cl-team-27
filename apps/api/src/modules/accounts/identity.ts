import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { z } from 'zod';

export interface VerifiedToken {
  readonly subject: string;
}

export interface Profile {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string | null;
}

export interface Identity {
  verify(token: string): Promise<VerifiedToken>;
  profile(token: string): Promise<Profile>;
}

export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

export interface Auth0Settings {
  readonly domain: string;
  readonly audience: string;
}

const userinfo = z.object({
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});

export class Auth0Identity implements Identity {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly keys: JWTVerifyGetKey;
  private readonly fetcher: typeof fetch;

  constructor(
    settings: Auth0Settings,
    keys?: JWTVerifyGetKey,
    fetcher: typeof fetch = fetch,
  ) {
    const host = settings.domain
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');
    this.issuer = `https://${host}/`;
    this.audience = settings.audience;
    this.keys =
      keys ??
      createRemoteJWKSet(new URL(`${this.issuer}.well-known/jwks.json`));
    this.fetcher = fetcher;
  }

  async verify(token: string): Promise<VerifiedToken> {
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256'],
      });
      if (!payload.sub) throw new InvalidTokenError('El token no trae sub');
      return { subject: payload.sub };
    } catch (error) {
      if (error instanceof InvalidTokenError) throw error;
      throw new InvalidTokenError(
        error instanceof Error ? error.message : 'Token inválido',
      );
    }
  }

  async profile(token: string): Promise<Profile> {
    const response = await this.fetcher(`${this.issuer}userinfo`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new InvalidTokenError(
        `Auth0 no entregó el perfil (HTTP ${response.status})`,
      );
    }
    const parsed = userinfo.safeParse(await response.json());
    if (!parsed.success) {
      throw new InvalidTokenError('El perfil de Auth0 no trae un correo');
    }
    return {
      email: parsed.data.email.toLowerCase(),
      emailVerified: parsed.data.email_verified ?? false,
      name: parsed.data.name ?? null,
    };
  }
}
