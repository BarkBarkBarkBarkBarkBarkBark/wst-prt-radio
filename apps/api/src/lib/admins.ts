import argon2 from 'argon2';
import { env } from './env.js';

interface AdminRecord {
  username: string;
  passwordHash: string;
}

let ADMINS: AdminRecord[] = [];

/**
 * Parse ADMIN_USERS env (`username:password,username:password`) and hash each
 * password with argon2 once at boot. Plaintext passwords are not retained.
 *
 * In development the default seed is `marco:barkbark,mun:woofwoof` (set in
 * env.ts). Production is required to override via `fly secrets set ADMIN_USERS=...`.
 */
export async function initializeAdmins(logger: { info: (msg: string) => void; warn: (msg: string) => void }): Promise<void> {
  const raw = env.ADMIN_USERS;
  const entries = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(':');
      if (idx <= 0 || idx === pair.length - 1) {
        throw new Error(`Bad ADMIN_USERS entry: ${pair}. Expected username:password.`);
      }
      return { username: pair.slice(0, idx).trim(), password: pair.slice(idx + 1) };
    });

  if (entries.length === 0) {
    throw new Error('ADMIN_USERS produced no usable entries.');
  }

  const seen = new Set<string>();
  const records: AdminRecord[] = [];
  for (const { username, password } of entries) {
    if (seen.has(username)) {
      throw new Error(`Duplicate admin username in ADMIN_USERS: ${username}`);
    }
    seen.add(username);
    records.push({ username, passwordHash: await argon2.hash(password) });
  }

  ADMINS = records;
  const isDefaultDevSeed =
    env.APP_ENV !== 'production' && raw === 'marco:barkbark,mun:woofwoof';
  if (isDefaultDevSeed) {
    logger.warn(
      '[admins] Using default development seed (marco:barkbark, mun:woofwoof). ' +
        'Set ADMIN_USERS in apps/api/.env to override.',
    );
  } else {
    logger.info(`[admins] Loaded ${records.length} admin user(s): ${records.map((r) => r.username).join(', ')}`);
  }
}

export async function verifyAdmin(username: string, password: string): Promise<boolean> {
  const record = ADMINS.find((a) => a.username === username);
  if (!record) {
    // Constant-time-ish: still hash a dummy to avoid trivial timing leak on
    // username enumeration. argon2.verify on a known-good hash is fine.
    await argon2.verify(
      '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$Vd0wWh1Yp9Wmav6zKAm1xkLQHE3PIv2H7Au+kyNIHzU',
      password,
    ).catch(() => undefined);
    return false;
  }
  try {
    return await argon2.verify(record.passwordHash, password);
  } catch {
    return false;
  }
}

export function listAdminUsernames(): string[] {
  return ADMINS.map((a) => a.username);
}
