import type { FastifyPluginAsync } from 'fastify';
import { requireSession } from '../../plugins/auth.js';
import { computeCurrentState } from '../../services/stationStateMachine.js';
import { getLatestNowPlaying } from '../../services/azuracastService.js';
import { getDb } from '../../db/client.js';

const dashboardRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/dashboard', { preHandler: requireSession, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (_request, reply) => {
    const db = getDb();
    const [mode, nowPlaying] = await Promise.all([
      computeCurrentState(),
      Promise.resolve(getLatestNowPlaying()),
    ]);

    const destinationCount = (
      db.prepare('SELECT COUNT(*) as count FROM destinations WHERE enabled = 1').get() as {
        count: number;
      }
    ).count;

    const recentAudit = db
      .prepare('SELECT action, entity_type, entity_id, created_at FROM audit_log ORDER BY created_at DESC LIMIT 5')
      .all();

    return reply.send({ mode, nowPlaying, destinationCount, recentAudit });
  });
};

export default dashboardRoute;
