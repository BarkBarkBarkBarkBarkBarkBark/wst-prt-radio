import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../../lib/requireAdmin.js';
import { getAlwaysOnPlaylist, getSongsDir } from '../../services/autoplayService.js';

const SONGS_DIR = getSongsDir();

const ALLOWED_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.oga']);

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._\- ]/g, '_').trim();
}

const adminSongsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/admin/songs', async (_request, reply) => {
    const playlist = getAlwaysOnPlaylist();
    return reply.send({ songs: playlist.tracks });
  });

  fastify.post('/admin/songs/upload', async (request, reply) => {
    if (!existsSync(SONGS_DIR)) {
      mkdirSync(SONGS_DIR, { recursive: true });
    }

    // Accept one or many files in a single request so bulk uploads from the
    // admin UI or the CLI script land in one round trip.
    const uploaded: string[] = [];
    const skipped: { filename: string; reason: string }[] = [];

    for await (const part of request.files()) {
      const ext = extname(part.filename).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        skipped.push({ filename: part.filename, reason: `Unsupported file type: ${ext}` });
        // Drain the stream so the multipart parser can move to the next part.
        part.file.resume();
        continue;
      }

      const safeFilename = sanitizeFilename(part.filename);
      const destPath = join(SONGS_DIR, safeFilename);
      await pipeline(part.file, createWriteStream(destPath));
      uploaded.push(safeFilename);
    }

    if (uploaded.length === 0 && skipped.length === 0) {
      return reply.status(400).send({ error: 'No file provided' });
    }

    if (uploaded.length === 0) {
      return reply
        .status(400)
        .send({ error: skipped[0]?.reason ?? 'No supported files uploaded', skipped });
    }

    const playlist = getAlwaysOnPlaylist();
    return reply.send({ ok: true, uploaded, skipped, songs: playlist.tracks });
  });

  fastify.delete('/admin/songs/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const safe = sanitizeFilename(decodeURIComponent(filename));
    const filePath = join(SONGS_DIR, safe);

    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: 'File not found' });
    }

    rmSync(filePath);
    const playlist = getAlwaysOnPlaylist();
    return reply.send({ ok: true, songs: playlist.tracks });
  });
};

export default adminSongsRoute;
