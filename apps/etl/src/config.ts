export interface Config {
  readonly apiUrl: string;
  readonly presenterKey: string;
}

export const DEFAULT_API_URL = 'http://localhost:3001';
export const DEFAULT_PRESENTER_KEY = 'sala-los-aromos';

export const readConfig = (env: NodeJS.ProcessEnv = process.env): Config => ({
  apiUrl: (env['API_URL'] || DEFAULT_API_URL).replace(/\/+$/, ''),
  presenterKey: env['PRESENTER_KEY'] || DEFAULT_PRESENTER_KEY,
});
