import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../../lib/requireAdmin.js';
import { getAlwaysOnPlaylist } from '../../services/autoplayService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = join(__dirname, '..', '..', '..', '..', '..', 'songs');

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

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file provided' });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return reply.status(400).send({ error: `Unsupported file type: ${ext}. Allowed: mp3, wav, ogg, flac, m4a` });
    }

    const safeFilename = sanitizeFilename(data.filename);
    const destPath = join(SONGS_DIR, safeFilename);

    await pipeline(data.file, createWriteStream(destPath));

    const playlist = getAlwaysOnPlaylist();
    return reply.send({ ok: true, filename: safeFilename, songs: playlist.tracks });
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
