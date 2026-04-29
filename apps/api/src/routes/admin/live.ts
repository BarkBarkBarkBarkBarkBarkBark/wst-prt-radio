import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { requireSession } from '../../plugins/auth.js';
import { getDb } from '../../db/client.js';
import { env } from '../../lib/env.js';

function writeAudit(
  db: ReturnType<typeof getDb>,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  data?: unknown,
) {
  db.prepare(
    `INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, data_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(nanoid(), actorUserId, action, entityType, entityId, data ? JSON.stringify(data) : null);
}

const StartVideoSessionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
});

const liveRoute: FastifyPluginAsync = async (fastify) => {
  // Open Web DJ link (audio live via AzuraCast)
  fastify.post(
    '/admin/live/audio/open-web-dj-link',
    { preHandler: requireSession },
    async (request, reply) => {
      const webDjUrl = `${env.AZURACAST_BASE_URL}/public/${env.AZURACAST_STATION_ID}/webdj`;
      writeAudit(
        getDb(),
        request.session.userId!,
        'open_web_dj_link',
        'live_session',
        'web_dj',
      );
      return reply.send({ url: webDjUrl });
    },
  );

  // Start a video live session
  fastify.post(
    '/admin/live/video/session',
    { preHandler: requireSession },
    async (request, reply) => {
      const parsed = StartVideoSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', issues: parsed.error.issues });
      }

      const db = getDb();
      const id = nanoid();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO live_sessions (id, mode, title, description, status, initiated_by_user_id, cloudflare_live_input_id)
         VALUES (?, 'live_video', ?, ?, 'pending', ?, ?)`,
      ).run(id, parsed.data.title, parsed.data.description ?? null, request.session.userId, env.CLOUDFLARE_LIVE_INPUT_ID);

      writeAudit(db, request.session.userId!, 'start_live_video_session', 'live_session', id, {
        title: parsed.data.title,
      });

      return reply.status(201).send({ id, status: 'pending', startedAt: now });
    },
  );

  // End a video live session
  fastify.post(
    '/admin/live/video/end',
    { preHandler: requireSession },
    async (request, reply) => {
      const db = getDb();
      const session = db
        .prepare(
          `SELECT id FROM live_sessions WHERE status IN ('pending', 'active') ORDER BY rowid DESC LIMIT 1`,
        )
        .get() as { id: string } | undefined;

      if (!session) {
        return reply.status(404).send({ error: 'No active live session' });
      }

      db.prepare(
        `UPDATE live_sessions SET status = 'ended', ended_at = datetime('now') WHERE id = ?`,
      ).run(session.id);

      writeAudit(db, request.session.userId!, 'end_live_video_session', 'live_session', session.id);

      return reply.send({ ok: true, id: session.id });
    },
  );
};

export default liveRoute;
