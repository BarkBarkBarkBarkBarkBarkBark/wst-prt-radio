import type { FastifyPluginAsync } from 'fastify';
import {
  createAlwaysOnTrackStream,
  getAlwaysOnPlaylist,
  getAlwaysOnTrackFile,
} from '../../services/autoplayService.js';

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
};

export default autoplayRoute;