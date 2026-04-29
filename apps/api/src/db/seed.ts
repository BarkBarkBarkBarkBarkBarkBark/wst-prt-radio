import { hash } from 'argon2';
import { nanoid } from 'nanoid';
import type { Database } from 'better-sqlite3';
import { env } from '../lib/env.js';

interface UserRow {
  id: string;
}

export async function seedAdminUser(db: Database): Promise<void> {
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(env.ADMIN_SEED_EMAIL) as UserRow | undefined;

  if (existing) {
    return;
  }

  const passwordHash = await hash(env.ADMIN_SEED_PASSWORD, { type: 2 }); // argon2id
  const id = nanoid();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, 'admin', ?, ?)`,
  ).run(id, env.ADMIN_SEED_EMAIL, passwordHash, now, now);

  console.log(`[seed] Admin user created: ${env.ADMIN_SEED_EMAIL}`);
}
