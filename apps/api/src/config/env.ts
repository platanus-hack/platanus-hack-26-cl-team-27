import { z } from 'zod';

const optionalText = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const blankAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const blankAsDefault = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankAsUndefined, schema);

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
    ANTHROPIC_API_KEY: z
      .string()
      .optional()
      .transform((value) => (value && value.trim() !== '' ? value : undefined)),
    AUTH0_DOMAIN: optionalText,
    AUTH0_AUDIENCE: optionalText,
    SUPERADMIN_EMAILS: z
      .string()
      .optional()
      .transform((value) =>
        (value ?? '')
          .split(',')
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    APS_CLIENT_ID: optionalText,
    APS_CLIENT_SECRET: optionalText,
    APS_BUCKET_KEY: optionalText,
    APS_CALLBACK_URL: optionalText.pipe(z.string().url().optional()),
    APS_TOKEN_KEY: optionalText.pipe(
      z
        .string()
        .regex(/^[0-9a-fA-F]{64}$/, 'deben ser 64 caracteres hexadecimales')
        .optional(),
    ),
    APS_WEBHOOK_SECRET: optionalText,
    GOOGLE_CLIENT_ID: optionalText,
    GOOGLE_CLIENT_SECRET: optionalText,
    GOOGLE_REDIRECT_URI: z
      .url()
      .default('http://localhost:3000/api/integrations/google/callback'),
    INTEGRATIONS_ENCRYPTION_KEY: optionalText.refine(
      (value) => value === undefined || value.length >= 16,
      'la clave de cifrado necesita al menos 16 caracteres',
    ),
    APP_BASE_URL: blankAsDefault(z.url().default('http://localhost:3000')),
    GMAIL_CLIENT_ID: optionalText,
    GMAIL_CLIENT_SECRET: optionalText,
    GMAIL_REFRESH_TOKEN: optionalText,
    EMAIL_FROM: blankAsDefault(
      z.string().trim().min(3).default('Vigente <appvigente@gmail.com>'),
    ),
    EMAIL_REDIRECT_TO: optionalText.pipe(z.email().optional()),
    INTEGRATIONS_POLL_SECONDS: blankAsDefault(
      z.coerce.number().int().min(0).max(3600).default(60),
    ),
    GOOGLE_WEBHOOK_URL: optionalText.pipe(
      z
        .url()
        .refine(
          (value) => value.startsWith('https://'),
          'Google solo avisa a una URL con HTTPS',
        )
        .optional(),
    ),
    INTEGRATIONS_WATCH_HOURS: blankAsDefault(
      z.coerce.number().min(1).max(24).default(24),
    ),
    INTEGRATIONS_FALLBACK_SECONDS: blankAsDefault(
      z.coerce.number().int().min(60).max(86_400).default(900),
    ),
  })
  .refine(
    (env) => env.NODE_ENV !== 'production' || env.CORS_ALLOW_ORIGINS !== true,
    {
      path: ['CORS_ALLOW_ORIGINS'],
      message: 'en producción no se permite "*"',
    },
  );

export type Env = z.output<typeof envSchema>;
