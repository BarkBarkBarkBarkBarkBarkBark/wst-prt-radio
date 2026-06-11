import type { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { requireAdmin } from '../../lib/requireAdmin.js';

export interface Artist {
  id: string;
  name: string;
  bio: string | null;
  image_url: string | null;
  links_json: string;
  is_published: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const adminArtistsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/admin/artists', async (_request, reply) => {
    const db = getDb();
    const artists = db.prepare('SELECT * FROM artists ORDER BY created_at DESC').all() as Artist[];
    return reply.send({ artists });
  });

  fastify.post('/admin/artists', async (request, reply) => {
    const body = request.body as {
      name: string;
      bio?: string;
      image_url?: string;
      links?: { label: string; url: string }[];
      is_published?: boolean;
    };

    if (!body.name) {
      return reply.status(400).send({ error: 'name is required' });
    }

    const db = getDb();
    const id = nanoid();
    const now = new Date().toISOString();
    const links = Array.isArray(body.links) ? body.links.filter((link) => link.label && link.url) : [];

    db.prepare(
      `INSERT INTO artists (id, name, bio, image_url, links_json, is_published, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      body.name,
      body.bio ?? null,
      body.image_url ?? null,
      JSON.stringify(links),
      body.is_published === false ? 0 : 1,
      request.adminUsername ?? 'admin',
      now,
      now,
    );

    const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(id) as Artist;
    return reply.status(201).send({ ok: true, artist });
  });

  fastify.patch('/admin/artists/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      bio: string;
      image_url: string;
      links: { label: string; url: string }[];
      is_published: boolean;
    }>;

    const db = getDb();
    const existing = db.prepare('SELECT * FROM artists WHERE id = ?').get(id) as Artist | undefined;
    if (!existing) {
      return reply.status(404).send({ error: 'Artist not found' });
    }

    const now = new Date().toISOString();
    const links = body.links !== undefined
      ? JSON.stringify(body.links.filter((link) => link.label && link.url))
      : existing.links_json;

    db.prepare(
      'UPDATE artists SET name=?, bio=?, image_url=?, links_json=?, is_published=?, updated_at=? WHERE id=?',
    ).run(
      body.name ?? existing.name,
      body.bio !== undefined ? body.bio : existing.bio,
      body.image_url !== undefined ? body.image_url : existing.image_url,
      links,
      body.is_published !== undefined ? (body.is_published ? 1 : 0) : existing.is_published,
      now,
      id,
    );

    const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(id) as Artist;
    return reply.send({ ok: true, artist });
  });

  fastify.delete('/admin/artists/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();
    const result = db.prepare('DELETE FROM artists WHERE id = ?').run(id);
    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Artist not found' });
    }
    return reply.send({ ok: true });
  });
};

export default adminArtistsRoute;