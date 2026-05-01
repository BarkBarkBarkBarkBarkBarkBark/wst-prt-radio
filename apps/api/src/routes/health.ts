import type { FastifyPluginAsync } from 'fastify';
import { getPublicStationStatus } from '../services/liveRoomService.js';

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      station: getPublicStationStatus(),
    });
  });
};

export default healthRoute;
