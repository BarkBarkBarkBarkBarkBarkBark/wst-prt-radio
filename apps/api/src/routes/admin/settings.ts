import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { requireSession } from '../../plugins/auth.js';
import { getDb } from '../../db/client.js';
import { encrypt } from '../../lib/crypto.js';

interface SettingsRow {
  id: string;
  station_name: string;
  azuracast_base_url: string;
  azuracast_public_stream_url: string;
  azuracast_public_api_url: string;
  cloudflare_account_id: string;
  cloudflare_live_input_id: string;
  default_stream_mode: string;
  created_at: string;
  updated_at: string;
}

const PatchSettingsSchema = z.object({
  stationName: z.string().min(1).max(100).optional(),
  azuracastBaseUrl: z.string().url().optional(),
  azuracastPublicStreamUrl: z.string().url().optional(),
  azuracastPublicApiUrl: z.string().url().optional(),
  azuracastApiKey: z.string().optional(),
  cloudflareAccountId: z.string().optional(),
  cloudflareLiveInputId: z.string().optional(),
  cloudflareApiToken: z.string().optional(),
  defaultStreamMode: z.enum(['autodj', 'live_audio', 'live_video']).optional(),
});

const settingsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/settings', { preHandler: requireSession, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (_request, reply) => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, station_name, azuracast_base_url, azuracast_public_stream_url,
                azuracast_public_api_url, cloudflare_account_id, cloudflare_live_input_id,
                default_stream_mode, created_at, updated_at
         FROM station_settings LIMIT 1`,
      )
      .get() as SettingsRow | undefined;

    if (!row) {
      return reply.send(null);
    }

    return reply.send({
      id: row.id,
      stationName: row.station_name,
      azuracastBaseUrl: row.azuracast_base_url,
      azuracastPublicStreamUrl: row.azuracast_public_stream_url,
      azuracastPublicApiUrl: row.azuracast_public_api_url,
      cloudflareAccountId: row.cloudflare_account_id,
      cloudflareLiveInputId: row.cloudflare_live_input_id,
      defaultStreamMode: row.default_stream_mode,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  fastify.patch('/admin/settings', { preHandler: requireSession, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = PatchSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', issues: parsed.error.issues });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM station_settings LIMIT 1').get() as
      | { id: string }
      | undefined;
    const now = new Date().toISOString();

    const data = parsed.data;
    if (!existing) {
      const id = nanoid();
      db.prepare(
        `INSERT INTO station_settings (id, station_name, azuracast_base_url, azuracast_public_stream_url,
          azuracast_public_api_url, azuracast_api_key_encrypted, cloudflare_account_id,
          cloudflare_live_input_id, cloudflare_api_token_encrypted, default_stream_mode,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        data.stationName ?? 'wstprtradio',
        data.azuracastBaseUrl ?? '',
        data.azuracastPublicStreamUrl ?? '',
        data.azuracastPublicApiUrl ?? '',
        data.azuracastApiKey ? encrypt(data.azuracastApiKey) : '',
        data.cloudflareAccountId ?? '',
        data.cloudflareLiveInputId ?? '',
        data.cloudflareApiToken ? encrypt(data.cloudflareApiToken) : '',
        data.defaultStreamMode ?? 'autodj',
        now,
        now,
      );
    } else {
      const updates: string[] = [];
      const values: unknown[] = [];
      if (data.stationName !== undefined) { updates.push('station_name = ?'); values.push(data.stationName); }
      if (data.azuracastBaseUrl !== undefined) { updates.push('azuracast_base_url = ?'); values.push(data.azuracastBaseUrl); }
      if (data.azuracastPublicStreamUrl !== undefined) { updates.push('azuracast_public_stream_url = ?'); values.push(data.azuracastPublicStreamUrl); }
      if (data.azuracastPublicApiUrl !== undefined) { updates.push('azuracast_public_api_url = ?'); values.push(data.azuracastPublicApiUrl); }
      if (data.azuracastApiKey !== undefined) { updates.push('azuracast_api_key_encrypted = ?'); values.push(encrypt(data.azuracastApiKey)); }
      if (data.cloudflareAccountId !== undefined) { updates.push('cloudflare_account_id = ?'); values.push(data.cloudflareAccountId); }
      if (data.cloudflareLiveInputId !== undefined) { updates.push('cloudflare_live_input_id = ?'); values.push(data.cloudflareLiveInputId); }
      if (data.cloudflareApiToken !== undefined) { updates.push('cloudflare_api_token_encrypted = ?'); values.push(encrypt(data.cloudflareApiToken)); }
      if (data.defaultStreamMode !== undefined) { updates.push('default_stream_mode = ?'); values.push(data.defaultStreamMode); }
      updates.push('updated_at = ?');
      values.push(now, existing.id);
      db.prepare(`UPDATE station_settings SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    db.prepare(
      `INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, data_json, created_at)
       VALUES (?, ?, 'update_settings', 'station_settings', 'singleton', ?, datetime('now'))`,
    ).run(nanoid(), request.session.userId, JSON.stringify(data));

    return reply.send({ ok: true });
  });
};

export default settingsRoute;
