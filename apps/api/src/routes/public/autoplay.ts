import type { FastifyPluginAsync } from 'fastify';
import {
  createAlwaysOnTrackStream,
  advanceAlwaysOnTrack,
  getAlwaysOnPlaylist,
  getAlwaysOnState,
  getAlwaysOnTrackFile,
} from '../../services/autoplayService.js';
import { broadcastAlwaysOnAdvance } from '../../services/liveRoomService.js';

const autoplayRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/public/autoplay', async (_request, reply) => {
    return reply.send(getAlwaysOnPlaylist());
  });

  fastify.get('/public/autoplay/files/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const track = getAlwaysOnTrackFile(filename);

    if (!track) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    reply.header('Cache-Control', 'public, max-age=3600');
    reply.type(track.mimeType);
    return reply.send(createAlwaysOnTrackStream(track.filePath));
  });

  /**
   * POST /public/autoplay/next
   * Called by a listener client when its local track ends.
   * The server advances its scheduler and broadcasts the new state to all listeners
   * via WebSocket so everyone jumps to the next track simultaneously.
   */
  fastify.post('/public/autoplay/next', async (_request, reply) => {
    advanceAlwaysOnTrack();
    broadcastAlwaysOnAdvance();
    return reply.send(getAlwaysOnState());
  });
};

export default autoplayRoute;
