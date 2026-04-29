import type { FastifyPluginAsync } from 'fastify';
import { requireSession } from '../../plugins/auth.js';
import { getDb } from '../../db/client.js';

const auditRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/audit', { preHandler: requireSession, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const db = getDb();
    const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };

    const rows = db
      .prepare(
        `SELECT id, actor_user_id, action, entity_type, entity_id, data_json, created_at
         FROM audit_log
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(parseInt(limit, 10), parseInt(offset, 10));

    const total = (db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number })
      .count;

    return reply.send({ total, rows });
  });
};

export default auditRoute;
