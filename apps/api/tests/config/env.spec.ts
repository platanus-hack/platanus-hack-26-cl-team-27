import { DEV_PRESENTER_KEY, envSchema } from '../../src/config/env.ts';

describe('envSchema', () => {
  it('aplica los defaults de desarrollo', () => {
    expect(envSchema.parse({})).toEqual({
      NODE_ENV: 'development',
      API_PORT: 3001,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5427/team27',
      CORS_ALLOW_ORIGINS: ['http://localhost:3000'],
      PRESENTER_KEY: DEV_PRESENTER_KEY,
    });
  });

  it('convierte el puerto a número y separa los orígenes', () => {
    const env = envSchema.parse({
      API_PORT: '4000',
      CORS_ALLOW_ORIGINS: 'http://localhost:3000, https://team27.example',
    });
    expect(env.API_PORT).toBe(4000);
    expect(env.CORS_ALLOW_ORIGINS).toEqual([
      'http://localhost:3000',
      'https://team27.example',
    ]);
  });

  it('rechaza un puerto inválido', () => {
    expect(envSchema.safeParse({ API_PORT: 'abc' }).success).toBe(false);
  });

  it('rechaza "*" en producción', () => {
    const result = envSchema.safeParse({
      NODE_ENV: 'production',
      CORS_ALLOW_ORIGINS: '*',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['CORS_ALLOW_ORIGINS']);
  });

  it('exige la clave del presentador en producción', () => {
    const result = envSchema.safeParse({
      NODE_ENV: 'production',
      CORS_ALLOW_ORIGINS: 'https://team27.example',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['PRESENTER_KEY']);
  });

  it('toma la clave del entorno', () => {
    const env = envSchema.parse({
      NODE_ENV: 'production',
      CORS_ALLOW_ORIGINS: 'https://team27.example',
      PRESENTER_KEY: 'clave-secreta',
    });
    expect(env.PRESENTER_KEY).toBe('clave-secreta');
  });
});
