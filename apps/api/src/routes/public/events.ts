import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/client.js';
import type { Event } from '../admin/events.js';

const publicEventsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/public/events', async (_request, reply) => {
    const db = getDb();
    const events = db
      .prepare('SELECT * FROM events WHERE is_published = 1 ORDER BY event_date ASC')
      .all() as Event[];
    return reply.send({ events });
  });
};

export default publicEventsRoute;
