import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../db/client.js';
import { getPublicStationStatus } from '../services/liveRoomService.js';

const healthRoute: FastifyPluginAsync = async (fastify) => {
  // Cheap liveness probe — used by Fly http_checks. No DB access.
  fastify.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe — pings SQLite and returns the station snapshot.
  fastify.get('/ready', async (_request, reply) => {
    try {
      getDb().prepare('SELECT 1').get();
    } catch (err) {
      return reply.status(503).send({
        status: 'unready',
        reason: err instanceof Error ? err.message : 'db_unreachable',
      });
    }
    return reply.send({
      status: 'ready',
      timestamp: new Date().toISOString(),
      station: getPublicStationStatus(),
    });
  });
};

export default healthRoute;
