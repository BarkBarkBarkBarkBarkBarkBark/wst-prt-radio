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
  }
  return db;
}

function runMigrations(database: Database.Database): void {
  const migrationSql = readFileSync(
    join(__dirname, 'migrations', '001_init.sql'),
    'utf8',
  );
  database.exec(migrationSql);
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
