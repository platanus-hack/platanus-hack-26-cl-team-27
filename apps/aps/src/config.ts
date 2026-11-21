export interface ApsCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface ApsConfig extends ApsCredentials {
  readonly bucketKey: string;
}

export class ConfigError extends Error {}

type Env = Readonly<Record<string, string | undefined>>;

const KEYS = ['APS_CLIENT_ID', 'APS_CLIENT_SECRET', 'APS_BUCKET_KEY'] as const;

const valueOf = (env: Env, key: string): string | null =>
  env[key]?.trim() || null;

const listing = (keys: readonly string[]): string => {
  const last = keys.at(-1) ?? '';
  return keys.length > 1 ? `${keys.slice(0, -1).join(', ')} y ${last}` : last;
};

export const readConfig = (env: Env): ApsConfig => {
  const missing = KEYS.filter((key) => !valueOf(env, key));
  if (missing.length > 0) {
    throw new ConfigError(
      `${missing.length > 1 ? 'Faltan' : 'Falta'} ${listing(missing)} en el .env de la raíz.`,
    );
  }
  return {
    clientId: valueOf(env, 'APS_CLIENT_ID') ?? '',
    clientSecret: valueOf(env, 'APS_CLIENT_SECRET') ?? '',
    bucketKey: valueOf(env, 'APS_BUCKET_KEY') ?? '',
  };
};
