import type { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { requireAdmin } from '../../lib/requireAdmin.js';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  venue: string | null;
  ticket_url: string | null;
  image_url: string | null;
  is_published: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const adminEventsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/admin/events', async (_request, reply) => {
    const db = getDb();
    const events = db.prepare('SELECT * FROM events ORDER BY event_date ASC').all() as Event[];
    return reply.send({ events });
  });

  fastify.post('/admin/events', async (request, reply) => {
    const body = request.body as {
      title: string;
      description?: string;
      event_date: string;
      venue?: string;
      ticket_url?: string;
      image_url?: string;
      is_published?: boolean;
    };

    if (!body.title || !body.event_date) {
      return reply.status(400).send({ error: 'title and event_date are required' });
    }

    const db = getDb();
    const id = nanoid();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO events (id, title, description, event_date, venue, ticket_url, image_url, is_published, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      body.title,
      body.description ?? null,
      body.event_date,
      body.venue ?? null,
      body.ticket_url ?? null,
      body.image_url ?? null,
      body.is_published === false ? 0 : 1,
      request.adminUsername ?? 'admin',
      now,
      now,
    );

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Event;
    return reply.status(201).send({ ok: true, event });
  });

  fastify.patch('/admin/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      title: string;
      description: string;
      event_date: string;
      venue: string;
      ticket_url: string;
      image_url: string;
      is_published: boolean;
    }>;

    const db = getDb();
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Event | undefined;
    if (!existing) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE events SET title=?, description=?, event_date=?, venue=?, ticket_url=?, image_url=?, is_published=?, updated_at=? WHERE id=?`,
    ).run(
      body.title ?? existing.title,
      body.description !== undefined ? body.description : existing.description,
      body.event_date ?? existing.event_date,
      body.venue !== undefined ? body.venue : existing.venue,
      body.ticket_url !== undefined ? body.ticket_url : existing.ticket_url,
      body.image_url !== undefined ? body.image_url : existing.image_url,
      body.is_published !== undefined ? (body.is_published ? 1 : 0) : existing.is_published,
      now,
      id,
    );

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Event;
    return reply.send({ ok: true, event });
  });

  fastify.delete('/admin/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();
    const result = db.prepare('DELETE FROM events WHERE id = ?').run(id);
    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }
    return reply.send({ ok: true });
  });
};

export default adminEventsRoute;
