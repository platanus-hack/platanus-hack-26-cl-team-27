import { envSchema } from '../../src/config/env.ts';

describe('envSchema', () => {
  it('aplica los defaults de desarrollo', () => {
    expect(envSchema.parse({})).toEqual({
      NODE_ENV: 'development',
      API_PORT: 3001,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5427/team27',
      CORS_ALLOW_ORIGINS: ['http://localhost:3000'],
      GOOGLE_REDIRECT_URI:
        'http://localhost:3000/api/integrations/google/callback',
      INTEGRATIONS_POLL_SECONDS: 60,
      INTEGRATIONS_WATCH_HOURS: 24,
      INTEGRATIONS_FALLBACK_SECONDS: 900,
      SUPERADMIN_EMAILS: [],
    });
  });

  it('los avisos de Google piden una URL con HTTPS', () => {
    const url = 'https://vigente.example/api/integrations/google/notifications';
    expect(
      envSchema.parse({ GOOGLE_WEBHOOK_URL: url }).GOOGLE_WEBHOOK_URL,
    ).toBe(url);
    expect(envSchema.parse({ GOOGLE_WEBHOOK_URL: '' }).GOOGLE_WEBHOOK_URL).toBe(
      undefined,
    );
    expect(
      envSchema.safeParse({
        GOOGLE_WEBHOOK_URL: 'http://localhost:3001/api/x',
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({ INTEGRATIONS_WATCH_HOURS: '48' }).success,
    ).toBe(false);
  });

  it('los conectores son opcionales y la clave de cifrado pide 16 caracteres', () => {
    const env = envSchema.parse({
      GOOGLE_CLIENT_ID: ' id ',
      GOOGLE_CLIENT_SECRET: 'secret',
      INTEGRATIONS_ENCRYPTION_KEY: 'una-clave-larga-de-prueba',
      INTEGRATIONS_POLL_SECONDS: '15',
    });
    expect(env.GOOGLE_CLIENT_ID).toBe('id');
    expect(env.INTEGRATIONS_POLL_SECONDS).toBe(15);
    expect(envSchema.parse({ GOOGLE_CLIENT_ID: '' }).GOOGLE_CLIENT_ID).toBe(
      undefined,
    );
    expect(
      envSchema.safeParse({ INTEGRATIONS_ENCRYPTION_KEY: 'corta' }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({ GOOGLE_REDIRECT_URI: 'no es una url' }).success,
    ).toBe(false);
  });

  it('SUPERADMIN_EMAILS es una lista de correos en minúsculas', () => {
    expect(
      envSchema.parse({
        SUPERADMIN_EMAILS: ' Ana@Vigente.example, ,bruno@vigente.example ',
      }).SUPERADMIN_EMAILS,
    ).toEqual(['ana@vigente.example', 'bruno@vigente.example']);
  });

  it('la clave de Anthropic es opcional: ausente o vacía deja la lectura determinista', () => {
    expect(envSchema.parse({}).ANTHROPIC_API_KEY).toBeUndefined();
    expect(
      envSchema.parse({ ANTHROPIC_API_KEY: '' }).ANTHROPIC_API_KEY,
    ).toBeUndefined();
    expect(
      envSchema.parse({ ANTHROPIC_API_KEY: '   ' }).ANTHROPIC_API_KEY,
    ).toBeUndefined();
    expect(
      envSchema.parse({ ANTHROPIC_API_KEY: 'sk-ant-x' }).ANTHROPIC_API_KEY,
    ).toBe('sk-ant-x');
  });

  it('las variables de APS son opcionales y se recortan', () => {
    expect(envSchema.parse({}).APS_CLIENT_ID).toBeUndefined();
    expect(envSchema.parse({ APS_CLIENT_ID: '   ' }).APS_CLIENT_ID).toBe(
      undefined,
    );
    expect(envSchema.parse({ APS_CLIENT_ID: ' id-b ' }).APS_CLIENT_ID).toBe(
      'id-b',
    );
  });

  it('el callback de APS es una URL y la clave de los tokens son 64 hexadecimales', () => {
    expect(
      envSchema.parse({ APS_TOKEN_KEY: '' }).APS_TOKEN_KEY,
    ).toBeUndefined();
    expect(
      envSchema.parse({ APS_TOKEN_KEY: ` ${'ab'.repeat(32)} ` }).APS_TOKEN_KEY,
    ).toBe('ab'.repeat(32));
    expect(() => envSchema.parse({ APS_TOKEN_KEY: 'corta' })).toThrow();
    expect(() => envSchema.parse({ APS_TOKEN_KEY: 'g'.repeat(64) })).toThrow();
    expect(
      envSchema.parse({
        APS_CALLBACK_URL: 'http://localhost:3000/api/integrations/aps/callback',
      }).APS_CALLBACK_URL,
    ).toBe('http://localhost:3000/api/integrations/aps/callback');
    expect(
      envSchema.parse({ APS_CALLBACK_URL: '' }).APS_CALLBACK_URL,
    ).toBeUndefined();
    expect(() => envSchema.parse({ APS_CALLBACK_URL: 'no-es-url' })).toThrow();
  });

  it('el secreto de los webhooks de Autodesk es opcional y se recorta', () => {
    expect(envSchema.parse({}).APS_WEBHOOK_SECRET).toBeUndefined();
    expect(
      envSchema.parse({ APS_WEBHOOK_SECRET: '   ' }).APS_WEBHOOK_SECRET,
    ).toBeUndefined();
    expect(
      envSchema.parse({ APS_WEBHOOK_SECRET: ' a1B2+c3/d4= ' })
        .APS_WEBHOOK_SECRET,
    ).toBe('a1B2+c3/d4=');
  });

  it('las variables de los conectores vacías valen su default', () => {
    const env = envSchema.parse({
      APS_WEBHOOK_SECRET: '',
      GOOGLE_WEBHOOK_URL: '',
      INTEGRATIONS_POLL_SECONDS: '',
      INTEGRATIONS_WATCH_HOURS: ' ',
      INTEGRATIONS_FALLBACK_SECONDS: '',
    });
    expect(env).toMatchObject({
      INTEGRATIONS_POLL_SECONDS: 60,
      INTEGRATIONS_WATCH_HOURS: 24,
      INTEGRATIONS_FALLBACK_SECONDS: 900,
    });
    expect(env.APS_WEBHOOK_SECRET).toBeUndefined();
    expect(env.GOOGLE_WEBHOOK_URL).toBeUndefined();
    expect(envSchema.parse({ INTEGRATIONS_POLL_SECONDS: '5' })).toMatchObject({
      INTEGRATIONS_POLL_SECONDS: 5,
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

  it('en producción arranca con los orígenes de la web y sin más claves', () => {
    const env = envSchema.parse({
      NODE_ENV: 'production',
      CORS_ALLOW_ORIGINS: 'https://team27.example',
    });
    expect(env.CORS_ALLOW_ORIGINS).toEqual(['https://team27.example']);
  });
});
