#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';

const API_BASE_URL = (process.env.API_BASE_URL || 'https://wst-prt-radio.fly.dev').replace(/\/$/, '');
const SRC_DIR = resolve(process.argv[2] || './songs');
const BATCH_SIZE = Math.max(1, Number.parseInt(process.env.BATCH_SIZE || '1', 10) || 1);
const REQUEST_TIMEOUT_MS = Math.max(60_000, Number.parseInt(process.env.REQUEST_TIMEOUT_MS || '1800000', 10) || 1_800_000);
const ALLOWED_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.oga', '.flac', '.m4a']);
const EXTENSION_PRIORITY = {
  '.mp3': 5,
  '.m4a': 4,
  '.flac': 3,
  '.wav': 2,
  '.ogg': 1,
  '.oga': 1,
};
const MIME_BY_EXTENSION = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
};

function collectFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    files.push(fullPath);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function uploadNameFor(filePath) {
  const rel = relative(SRC_DIR, filePath).replace(/\\/g, ' - ');
  return rel || basename(filePath);
}

function preferredLocalFiles(filePaths) {
  const byBaseName = new Map();
  for (const filePath of filePaths) {
    const ext = extname(filePath).toLowerCase();
    const key = filePath.slice(0, -ext.length).toLowerCase();
    const existing = byBaseName.get(key);
    if (!existing) {
      byBaseName.set(key, filePath);
      continue;
    }
    const nextPriority = EXTENSION_PRIORITY[ext] || 0;
    const currentPriority = EXTENSION_PRIORITY[extname(existing).toLowerCase()] || 0;
    if (nextPriority > currentPriority) {
      byBaseName.set(key, filePath);
    }
  }
  return Array.from(byBaseName.values()).sort((a, b) => a.localeCompare(b));
}

async function fetchPlaylist() {
  const res = await fetch(`${API_BASE_URL}/public/autoplay`);
  if (!res.ok) throw new Error(`Playlist fetch failed (${res.status})`);
  return res.json();
}

async function uploadBatch(filePaths) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const form = new FormData();
    for (const filePath of filePaths) {
      const ext = extname(filePath).toLowerCase();
      const blob = new Blob([readFileSync(filePath)], { type: MIME_BY_EXTENSION[ext] || 'application/octet-stream' });
      form.append('file', blob, uploadNameFor(filePath));
    }
    const res = await fetch(`${API_BASE_URL}/admin/songs/upload`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Upload failed (${res.status}): ${text.slice(0, 300)}`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!statSync(SRC_DIR).isDirectory()) {
    throw new Error(`Source directory not found: ${SRC_DIR}`);
  }

  const localFiles = preferredLocalFiles(collectFiles(SRC_DIR));
  if (localFiles.length === 0) {
    throw new Error(`No supported audio files found in ${SRC_DIR}`);
  }

  const playlist = await fetchPlaylist();
  const existing = new Set((playlist.tracks || []).map((track) => String(track.filename)));
  const pending = localFiles.filter((filePath) => !existing.has(uploadNameFor(filePath)));

  console.log(`Local files: ${localFiles.length}`);
  console.log(`Already on API: ${localFiles.length - pending.length}`);
  console.log(`Pending upload: ${pending.length}`);

  let uploaded = 0;
  for (let index = 0; index < pending.length; index += BATCH_SIZE) {
    const batch = pending.slice(index, index + BATCH_SIZE);
    await uploadBatch(batch);
    uploaded += batch.length;
    console.log(`Uploaded ${uploaded} of ${pending.length}`);
  }

  const refreshed = await fetchPlaylist();
  console.log(`API playlist tracks: ${(refreshed.tracks || []).length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
