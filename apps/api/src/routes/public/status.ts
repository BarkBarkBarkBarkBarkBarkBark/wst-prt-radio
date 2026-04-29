import type { FastifyPluginAsync } from 'fastify';
import { computeCurrentState } from '../../services/stationStateMachine.js';
import { getLatestNowPlaying } from '../../services/azuracastService.js';
import { getDb } from '../../db/client.js';

interface LiveSessionRow {
  id: string;
  mode: string;
  title: string;
  status: string;
  started_at: string | null;
}

const statusRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/public/status', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (_request, reply) => {
    const mode = await computeCurrentState();
    const nowPlaying = getLatestNowPlaying();

    const db = getDb();
    const liveSessionRow = db
      .prepare(
        `SELECT id, mode, title, status, started_at
         FROM live_sessions
         WHERE status IN ('pending', 'active')
         ORDER BY rowid DESC LIMIT 1`,
      )
      .get() as LiveSessionRow | undefined;

    const liveSession = liveSessionRow
      ? {
          id: liveSessionRow.id,
          mode: liveSessionRow.mode as 'live_audio' | 'live_video',
          title: liveSessionRow.title,
          status: liveSessionRow.status as 'pending' | 'active' | 'ended',
          startedAt: liveSessionRow.started_at,
        }
      : null;

    return reply.send({ mode, nowPlaying, liveSession });
  });
};

export default statusRoute;
