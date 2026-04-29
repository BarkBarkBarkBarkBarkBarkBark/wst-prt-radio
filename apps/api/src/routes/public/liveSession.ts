import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/client.js';

interface LiveSessionRow {
  id: string;
  mode: string;
  title: string;
  status: string;
  started_at: string | null;
}

const liveSessionRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/public/live-session', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (_request, reply) => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, mode, title, status, started_at
         FROM live_sessions
         WHERE status IN ('pending', 'active')
         ORDER BY rowid DESC LIMIT 1`,
      )
      .get() as LiveSessionRow | undefined;

    if (!row) {
      return reply.send(null);
    }

    return reply.send({
      id: row.id,
      mode: row.mode,
      title: row.title,
      status: row.status,
      startedAt: row.started_at,
    });
  });
};

export default liveSessionRoute;
