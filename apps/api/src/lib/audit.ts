import { nanoid } from 'nanoid';
import { getDb } from '../db/client.js';

type AuditDb = ReturnType<typeof getDb>;

export function writeAudit(
  db: AuditDb,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  data?: unknown,
): void {
  db.prepare(
    `INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, data_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(nanoid(), actorUserId, action, entityType, entityId, data ? JSON.stringify(data) : null);
}