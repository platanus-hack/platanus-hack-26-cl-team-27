import { z } from 'zod';

export const DEV_PRESENTER_KEY = 'sala-los-aromos';

const optionalText = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z
      .string()
      .min(1)
      .default('postgresql://postgres:postgres@localhost:5427/team27'),
    CORS_ALLOW_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value === '*'
          ? true
          : value
              .split(',')
              .map((origin) => origin.trim())
              .filter(Boolean),
      ),
    PROJECT_ID: optionalText,
    PRESENTER_KEY: z.string().min(8).optional(),
    ANTHROPIC_API_KEY: z
      .string()
      .optional()
      .transform((value) => (value && value.trim() !== '' ? value : undefined)),
    AUTH0_DOMAIN: optionalText,
    AUTH0_AUDIENCE: optionalText,
    APS_CLIENT_ID: optionalText,
    APS_CLIENT_SECRET: optionalText,
    APS_BUCKET_KEY: optionalText,
    GOOGLE_CLIENT_ID: optionalText,
    GOOGLE_CLIENT_SECRET: optionalText,
    GOOGLE_REDIRECT_URI: z
      .url()
      .default('http://localhost:3000/api/integrations/google/callback'),
    INTEGRATIONS_ENCRYPTION_KEY: optionalText.refine(
      (value) => value === undefined || value.length >= 16,
      'la clave de cifrado necesita al menos 16 caracteres',
    ),
    INTEGRATIONS_POLL_SECONDS: z.coerce
      .number()
      .int()
      .min(0)
      .max(3600)
      .default(60),
  })
  .refine(
    (env) => env.NODE_ENV !== 'production' || env.CORS_ALLOW_ORIGINS !== true,
    {
      path: ['CORS_ALLOW_ORIGINS'],
      message: 'en producción no se permite "*"',
    },
  )
  .refine(
    (env) => env.NODE_ENV !== 'production' || env.PRESENTER_KEY !== undefined,
    {
      path: ['PRESENTER_KEY'],
      message: 'en producción la clave del presentador es obligatoria',
    },
  )
  .transform((env) => ({
    ...env,
    PRESENTER_KEY: env.PRESENTER_KEY ?? DEV_PRESENTER_KEY,
  }));

export type Env = z.output<typeof envSchema>;
