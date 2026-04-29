import type { FastifyPluginAsync } from 'fastify';
import { requireSession } from '../../plugins/auth.js';
import { computeCurrentState } from '../../services/stationStateMachine.js';
import { getLatestNowPlaying, isLiveDjConnected } from '../../services/azuracastService.js';
import { getLiveInputStatus } from '../../services/cloudflareStreamService.js';

const stationRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/station/status', { preHandler: requireSession }, async (_request, reply) => {
    const [mode, cfStatus] = await Promise.all([
      computeCurrentState(),
      getLiveInputStatus(),
    ]);

    return reply.send({
      mode,
      nowPlaying: getLatestNowPlaying(),
      azuracastLive: isLiveDjConnected(),
      cloudflareConnected: cfStatus === 'connected',
      cloudflareStatus: cfStatus,
    });
  });
};

export default stationRoute;
