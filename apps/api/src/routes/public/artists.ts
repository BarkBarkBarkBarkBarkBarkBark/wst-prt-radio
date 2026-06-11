import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/client.js';
import type { Artist } from '../admin/artists.js';

const publicArtistsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/public/artists', async (_request, reply) => {
    const db = getDb();
    const artists = db
      .prepare('SELECT * FROM artists WHERE is_published = 1 ORDER BY created_at DESC')
      .all() as Artist[];
    return reply.send({ artists });
  });
};

export default publicArtistsRoute;