import type { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';

const azuracastWebhook: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhooks/azuracast', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const db = getDb();
    const payload = request.body as Record<string, unknown>;
    const eventType = (payload?.['type'] as string) ?? 'unknown';

    db.prepare(
      `INSERT INTO webhook_events (id, source, event_type, payload_json, received_at, status)
       VALUES (?, 'azuracast', ?, ?, datetime('now'), 'pending')`,
    ).run(nanoid(), eventType, JSON.stringify(payload));

    return reply.status(200).send({ ok: true });
  });
};

export default azuracastWebhook;
