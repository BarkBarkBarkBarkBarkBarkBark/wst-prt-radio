import type { FastifyPluginAsync } from 'fastify';
import { getPublicStationStatus } from '../../services/liveRoomService.js';

const statusRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/public/status', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (_request, reply) => {
    return reply.send(getPublicStationStatus());
  });
};

export default statusRoute;
