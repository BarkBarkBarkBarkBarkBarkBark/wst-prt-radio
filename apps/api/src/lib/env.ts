import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  BACKEND_ENCRYPTION_KEY: z
    .string()
    .length(64, 'BACKEND_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)'),
  SQLITE_DB_PATH: z.string().min(1),
  ADMIN_SEED_EMAIL: z.string().email(),
  ADMIN_SEED_PASSWORD: z.string().min(8),
  AZURACAST_BASE_URL: z.string().url(),
  AZURACAST_PUBLIC_STREAM_URL: z.string().url(),
  AZURACAST_PUBLIC_API_URL: z.string().url(),
  AZURACAST_API_KEY: z.string().default(''),
  AZURACAST_STATION_ID: z.coerce.number().int().positive().default(1),
  CLOUDFLARE_ACCOUNT_ID: z.string().default(''),
  CLOUDFLARE_STREAM_API_TOKEN: z.string().default(''),
  CLOUDFLARE_LIVE_INPUT_ID: z.string().default(''),
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
});

function validateEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }
  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;
