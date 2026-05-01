import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
  CORS_DEV_LAN: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  SQLITE_DB_PATH: z.string().min(1),
  STATION_NAME: z.string().min(1).default('West Port Radio'),
  SESSION_SECRET: z.string().optional(),
  ADMIN_USERS: z.string().optional(),
});

function validateEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  const parsed = result.data;

  // Production guardrails: refuse to boot without the secrets that gate admin
  // access, rather than auto-generating something that wipes every cookie on
  // every deploy.
  if (parsed.APP_ENV === 'production') {
    if (!parsed.SESSION_SECRET || parsed.SESSION_SECRET.length < 32) {
      throw new Error(
        'SESSION_SECRET must be set to at least 32 characters in production. ' +
          'Generate one with: openssl rand -hex 32',
      );
    }
    if (!parsed.ADMIN_USERS || !parsed.ADMIN_USERS.includes(':')) {
      throw new Error(
        'ADMIN_USERS must be set in production as username:password,username:password',
      );
    }
  }

  return {
    ...parsed,
    SESSION_SECRET: parsed.SESSION_SECRET || randomBytes(32).toString('hex'),
    ADMIN_USERS: parsed.ADMIN_USERS || 'marco:barkbark,mun:woofwoof',
  };
}

export const env = validateEnv();
export type Env = typeof env;
