import { getDb } from '../db/client.js';

const AUDIT_LOG_KEEP = 1_000;
const HOUR_MS = 60 * 60 * 1_000;

let timer: NodeJS.Timeout | null = null;

/**
 * Trim audit_log to the most recent N entries to keep SQLite from ballooning
 * across years of admin actions. Idempotent; safe to call repeatedly.
 */
export function trimAuditLog(): { deleted: number } {
  const result = getDb()
    .prepare(
      `DELETE FROM audit_log WHERE id NOT IN (
         SELECT id FROM audit_log ORDER BY created_at DESC LIMIT ?
       )`,
    )
    .run(AUDIT_LOG_KEEP);
  return { deleted: result.changes };
}

export function startCleanupSchedule(logger: { info: (msg: string) => void }): void {
  if (timer) return;
  // Run once at boot to handle any backlog from before this code shipped, then
  // hourly forever.
  const tick = () => {
    try {
      const { deleted } = trimAuditLog();
      if (deleted > 0) logger.info(`[cleanup] Trimmed ${deleted} old audit_log row(s)`);
    } catch (err) {
      logger.info(`[cleanup] trim failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  tick();
  timer = setInterval(tick, HOUR_MS);
  // Don't keep the event loop alive just for this.
  timer.unref?.();
}

export function stopCleanupSchedule(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
