import type { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';

const cloudflareStreamWebhook: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhooks/cloudflare-stream', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const db = getDb();
    const payload = request.body as Record<string, unknown>;
    const eventType = (payload?.['type'] as string) ?? 'unknown';

    db.prepare(
      `INSERT INTO webhook_events (id, source, event_type, payload_json, received_at, status)
       VALUES (?, 'cloudflare_stream', ?, ?, datetime('now'), 'pending')`,
    ).run(nanoid(), eventType, JSON.stringify(payload));

    // Update live session status based on stream events
    if (eventType === 'live_input.connected') {
      db.prepare(
        `UPDATE live_sessions SET status = 'active', started_at = datetime('now')
         WHERE status = 'pending' ORDER BY rowid DESC LIMIT 1`,
      ).run();
    } else if (eventType === 'live_input.disconnected') {
      db.prepare(
        `UPDATE live_sessions SET status = 'ended', ended_at = datetime('now')
         WHERE status = 'active' ORDER BY rowid DESC LIMIT 1`,
      ).run();
    }

    return reply.status(200).send({ ok: true });
  });
};

export default cloudflareStreamWebhook;
