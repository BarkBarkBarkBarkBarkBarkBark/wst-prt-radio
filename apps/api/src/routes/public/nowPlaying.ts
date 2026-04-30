import type { FastifyPluginAsync } from 'fastify';
import { getLatestNowPlaying } from '../../services/azuracastService.js';

const nowPlayingRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/public/now-playing', async (_request, reply) => {
    const nowPlaying = getLatestNowPlaying();
    return reply.send(nowPlaying);
  });
};

export default nowPlayingRoute;
