import { nanoid } from 'nanoid';
import { getDb } from '../db/client.js';

type AuditDb = ReturnType<typeof getDb>;

export function writeAudit(
  db: AuditDb,
  actor: string,
  action: string,
  entityType: string | null,
  entityId: string | null,
  data?: unknown,
): void {
  db.prepare(
    `INSERT INTO audit_log (id, actor, action, entity_type, entity_id, data_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(nanoid(), actor, action, entityType, entityId, data ? JSON.stringify(data) : null);
}