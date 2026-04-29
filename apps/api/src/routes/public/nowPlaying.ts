import type { FastifyPluginAsync } from 'fastify';
import { getLatestNowPlaying } from '../../services/azuracastService.js';

const nowPlayingRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/public/now-playing', async (_request, reply) => {
    const nowPlaying = getLatestNowPlaying();
    if (!nowPlaying) {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'No data yet' });
    }
    return reply.send(nowPlaying);
  });
};

export default nowPlayingRoute;
