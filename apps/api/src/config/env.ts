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
    PRESENTER_KEY: z.string().min(8).optional(),
    ANTHROPIC_API_KEY: z
      .string()
      .optional()
      .transform((value) => (value && value.trim() !== '' ? value : undefined)),
    APS_CLIENT_ID: optionalText,
    APS_CLIENT_SECRET: optionalText,
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
