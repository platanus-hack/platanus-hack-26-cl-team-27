import { ConfigError, readConfig } from '../src/config.ts';

describe('readConfig', () => {
  it('lee las credenciales y el bucket, recortados', () => {
    expect(
      readConfig({
        APS_CLIENT_ID: ' id ',
        APS_CLIENT_SECRET: 'secret',
        APS_BUCKET_KEY: 'vigente-b',
      }),
    ).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      bucketKey: 'vigente-b',
    });
  });

  it('nombra todo lo que falta, sin mostrar valores', () => {
    expect(() => readConfig({})).toThrow(
      new ConfigError(
        'Faltan APS_CLIENT_ID, APS_CLIENT_SECRET y APS_BUCKET_KEY en el .env de la raíz.',
      ),
    );
    expect(() =>
      readConfig({
        APS_CLIENT_ID: 'id',
        APS_CLIENT_SECRET: 'secret',
        APS_BUCKET_KEY: '  ',
      }),
    ).toThrow('Falta APS_BUCKET_KEY en el .env de la raíz.');
  });
});
