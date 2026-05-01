import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { env } from '../lib/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(env.SQLITE_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    initializeCoreRows(db);
  }
  return db;
}

function runMigrations(database: Database.Database): void {
  // Apply base schema (CREATE TABLE IF NOT EXISTS — safe to re-run)
  const migrationSql = readFileSync(
    join(__dirname, 'migrations', '001_init.sql'),
    'utf8',
  );
  database.exec(migrationSql);

  // Data migrations: rename actor_user_id -> actor if the old column exists
  const auditCols: { name: string }[] = database
    .prepare("PRAGMA table_info(audit_log)")
    .all() as { name: string }[];
  const hasOldCol = auditCols.some((c) => c.name === 'actor_user_id');
  if (hasOldCol) {
    database.exec('ALTER TABLE audit_log RENAME COLUMN actor_user_id TO actor');
  }
}

function initializeCoreRows(database: Database.Database): void {
  database.prepare(
    `INSERT INTO stream_state (id, station_state, live_session_id, broadcaster_peer_id, broadcaster_display_name, updated_at)
     VALUES ('primary', 'open', NULL, NULL, NULL, ?)
     ON CONFLICT(id) DO NOTHING`,
  ).run(new Date().toISOString());
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
