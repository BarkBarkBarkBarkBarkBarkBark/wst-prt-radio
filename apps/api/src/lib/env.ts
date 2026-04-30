import { z } from 'zod';

const OptionalUrlSchema = z.string().url().or(z.literal('')).default('');

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  BACKEND_ENCRYPTION_KEY: z
    .string()
    .length(64, 'BACKEND_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)'),
  SQLITE_DB_PATH: z.string().min(1),
  ADMIN_SEED_EMAIL: z.string().email(),
  ADMIN_SEED_PASSWORD: z.string().min(8),
  STREAM_PUBLIC_URL: z.string().url(),
  STREAM_METADATA_PROVIDER: z.enum(['static', 'azuracast']).default('static'),
  STATIC_NOW_PLAYING_TITLE: z.string().min(1).default('West Port Radio'),
  STATIC_NOW_PLAYING_ARTIST: z.string().min(1).default('Icecast Stream'),
  STATIC_NOW_PLAYING_ALBUM: z.string().default(''),
  LIVE_ROOM_DEFAULT_TITLE: z.string().min(1).default('West Port Open Mic'),
  LIVE_ROOM_DEFAULT_ACCESS: z.enum(['open', 'passphrase']).default('open'),
  LIVE_ROOM_DEFAULT_MODE: z.enum(['open_mic', 'official']).default('open_mic'),
  LIVE_ROOM_SHARED_PASSPHRASE: z.string().default(''),
  LIVE_ROOM_HOST_SECRET: z.string().default(''),
  AZURACAST_BASE_URL: OptionalUrlSchema,
  AZURACAST_PUBLIC_STREAM_URL: OptionalUrlSchema,
  AZURACAST_PUBLIC_API_URL: OptionalUrlSchema,
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
