import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AlwaysOnTrack {
  id: string;
  title: string;
  filename: string;
  url: string;
  mimeType: string;
}

export interface AlwaysOnPlaylist {
  tracks: AlwaysOnTrack[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = join(__dirname, '..', '..', '..', '..', 'songs');

const MIME_BY_EXTENSION: Record<string, string> = {
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
};

const EXTENSION_PRIORITY: Record<string, number> = {
  '.mp3': 5,
  '.m4a': 4,
  '.flac': 3,
  '.wav': 2,
  '.ogg': 1,
  '.oga': 1,
};

function titleFromFilename(filename: string): string {
  return filename
    .replace(extname(filename), '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canServeFile(filename: string): boolean {
  return /^[A-Za-z0-9._ -]+$/.test(filename) && Boolean(MIME_BY_EXTENSION[extname(filename).toLowerCase()]);
}

export function getAlwaysOnPlaylist(): AlwaysOnPlaylist {
  if (!existsSync(SONGS_DIR)) {
    return { tracks: [] };
  }

  const preferredFiles = new Map<string, string>();

  for (const filename of readdirSync(SONGS_DIR).filter(canServeFile).sort((a, b) => a.localeCompare(b))) {
    const key = filename.replace(extname(filename), '').toLowerCase();
    const existing = preferredFiles.get(key);
    if (!existing) {
      preferredFiles.set(key, filename);
      continue;
    }

    const nextPriority = EXTENSION_PRIORITY[extname(filename).toLowerCase()] ?? 0;
    const existingPriority = EXTENSION_PRIORITY[extname(existing).toLowerCase()] ?? 0;
    if (nextPriority > existingPriority) {
      preferredFiles.set(key, filename);
    }
  }

  const tracks = Array.from(preferredFiles.values())
    .filter(canServeFile)
    .sort((a, b) => a.localeCompare(b))
    .map((filename, index) => ({
      id: `track-${index + 1}`,
      title: titleFromFilename(filename),
      filename,
      url: `/public/autoplay/files/${encodeURIComponent(filename)}`,
      mimeType: MIME_BY_EXTENSION[extname(filename).toLowerCase()] ?? 'application/octet-stream',
    }));

  return { tracks };
}

export function getAlwaysOnTrackFile(filename: string): { filePath: string; mimeType: string } | null {
  if (!canServeFile(filename)) {
    return null;
  }

  const filePath = join(SONGS_DIR, filename);
  if (!existsSync(filePath)) {
    return null;
  }

  return {
    filePath,
    mimeType: MIME_BY_EXTENSION[extname(filename).toLowerCase()] ?? 'application/octet-stream',
  };
}

export function createAlwaysOnTrackStream(filePath: string) {
  return createReadStream(filePath);
}