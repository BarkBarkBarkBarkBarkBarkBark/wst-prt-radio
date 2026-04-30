import type { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { requireSession } from '../../plugins/auth.js';
import { getDb } from '../../db/client.js';
import { encrypt } from '../../lib/crypto.js';
import { writeAudit } from '../../lib/audit.js';
import { createOutput } from '../../services/cloudflareStreamService.js';

interface DestinationRow {
  id: string;
  kind: string;
  name: string;
  enabled: number;
  url: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function rowToDestination(row: DestinationRow) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    enabled: row.enabled === 1,
    url: row.url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CreateSchema = z.object({
  kind: z.enum(['twitch', 'instagram', 'custom_rtmp', 'custom_srt', 'tiktok_experimental', 'discord_notify']),
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  url: z.string(),
  streamKey: z.string().optional(),
  srtPassphrase: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

const UpdateSchema = CreateSchema.partial();

const destinationsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/destinations', { preHandler: requireSession, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (_request, reply) => {
    const db = getDb();
    const rows = db
      .prepare('SELECT id, kind, name, enabled, url, sort_order, created_at, updated_at FROM destinations ORDER BY sort_order ASC')
      .all() as DestinationRow[];
    return reply.send(rows.map(rowToDestination));
  });

  fastify.post('/admin/destinations', { preHandler: requireSession, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = CreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', issues: parsed.error.issues });
    }

    const { kind, name, enabled, url, streamKey, srtPassphrase, sortOrder } = parsed.data;
    const db = getDb();
    const id = nanoid();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO destinations (id, kind, name, enabled, url, stream_key_encrypted, srt_passphrase_encrypted, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      kind,
      name,
      enabled ? 1 : 0,
      url,
      streamKey ? encrypt(streamKey) : null,
      srtPassphrase ? encrypt(srtPassphrase) : null,
      sortOrder,
      now,
      now,
    );

    writeAudit(db, request.session.userId!, 'create_destination', 'destination', id, { kind, name });
    return reply.status(201).send({ id, kind, name, enabled, url, sortOrder, createdAt: now, updatedAt: now });
  });

  fastify.patch('/admin/destinations/:id', { preHandler: requireSession, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', issues: parsed.error.issues });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM destinations WHERE id = ?').get(id);
    if (!existing) return reply.status(404).send({ error: 'Not Found' });

    const { kind, name, enabled, url, streamKey, srtPassphrase, sortOrder } = parsed.data;
    const now = new Date().toISOString();

    const updates: string[] = [];
    const values: unknown[] = [];
    if (kind !== undefined) { updates.push('kind = ?'); values.push(kind); }
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
    if (url !== undefined) { updates.push('url = ?'); values.push(url); }
    if (streamKey !== undefined) { updates.push('stream_key_encrypted = ?'); values.push(encrypt(streamKey)); }
    if (srtPassphrase !== undefined) { updates.push('srt_passphrase_encrypted = ?'); values.push(encrypt(srtPassphrase)); }
    if (sortOrder !== undefined) { updates.push('sort_order = ?'); values.push(sortOrder); }
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE destinations SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    writeAudit(db, request.session.userId!, 'update_destination', 'destination', id, parsed.data);

    return reply.send({ ok: true });
  });

  fastify.delete('/admin/destinations/:id', { preHandler: requireSession, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();
    const existing = db.prepare('SELECT id FROM destinations WHERE id = ?').get(id);
    if (!existing) return reply.status(404).send({ error: 'Not Found' });

    db.prepare('DELETE FROM destinations WHERE id = ?').run(id);
    writeAudit(db, request.session.userId!, 'delete_destination', 'destination', id);
    return reply.send({ ok: true });
  });

  // Test a destination by attempting to create a CF output
  fastify.post('/admin/destinations/:id/test', { preHandler: requireSession, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();
    const row = db.prepare('SELECT id, url FROM destinations WHERE id = ?').get(id) as { id: string; url: string } | undefined;
    if (!row) return reply.status(404).send({ error: 'Not Found' });

    const outputId = await createOutput(row.url, 'test-stream-key');
    return reply.send({ ok: outputId !== null, cloudflareOutputId: outputId });
  });
};

export default destinationsRoute;
