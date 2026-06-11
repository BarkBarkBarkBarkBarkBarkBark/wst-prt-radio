#!/usr/bin/env node
/**
 * Untitled.stream -> West Port Radio sync utility.
 *
 * This script does not execute shell commands or third-party code.
 * It fetches project pages, resolves audio URLs, downloads tracks locally,
 * and uploads them via the existing /admin/songs/upload API endpoint.
 *
 * Required env:
 *   API_BASE_URL                API origin, e.g. https://wst-prt-radio.fly.dev
 *
 * Input options (pick one):
 *   UNTITLED_PROJECT_URLS       Comma-separated project URLs
 *   UNTITLED_URLS_FILE          Text file with one project URL per line
 *   UNTITLED_LIBRARY_URL        Library URL (default https://untitled.stream/library)
 *
 * Optional env:
 *   UNTITLED_COOKIE             Cookie header value for logged-in/private pages
 *   API_ADMIN_USER              API admin username for /auth/login
 *   API_ADMIN_PASS              API admin password for /auth/login
 *   UNTITLED_OUTPUT_DIR         Local download folder (default ./songs/untitled-sync)
 *   UNTITLED_MAX_CONCURRENCY    Download concurrency (default 4)
 *   UNTITLED_UPLOAD_BATCH_SIZE  Files per upload request (default 8)
 *   UNTITLED_DRY_RUN            1 to skip downloads/uploads and print plan
 */

import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

const SIGNED_URL_API =
  'https://untitled.stream/api/storage/buckets/private-transcoded-audio/objects/{MUSIC_URL}/signedUrl?durationInSeconds=10800&cacheBufferInSeconds=600';

const API_BASE_URL = requiredEnv('API_BASE_URL').replace(/\/$/, '');
const UNTITLED_LIBRARY_URL = process.env.UNTITLED_LIBRARY_URL || 'https://untitled.stream/library';
const UNTITLED_COOKIE = process.env.UNTITLED_COOKIE || '';
const API_ADMIN_USER = process.env.API_ADMIN_USER || '';
const API_ADMIN_PASS = process.env.API_ADMIN_PASS || '';
const UNTITLED_OUTPUT_DIR = resolve(process.env.UNTITLED_OUTPUT_DIR || './songs/untitled-sync');
const UNTITLED_MAX_CONCURRENCY = parsePositiveInt(process.env.UNTITLED_MAX_CONCURRENCY, 4);
const UNTITLED_UPLOAD_BATCH_SIZE = parsePositiveInt(process.env.UNTITLED_UPLOAD_BATCH_SIZE, 8);
const UNTITLED_DRY_RUN = (process.env.UNTITLED_DRY_RUN || '').trim() === '1';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value.trim();
}

function parsePositiveInt(raw, fallback) {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sanitizeName(name) {
  return name.replace(/[^A-Za-z0-9._\- ]/g, '_').replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function fetchText(url) {
  const headers = {
    'user-agent': 'wstprtradio-sync/1.0',
  };
  if (UNTITLED_COOKIE) headers.cookie = UNTITLED_COOKIE;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return res.text();
}

function extractRemixContextJson(html) {
  const marker = 'window.__remixContext = ';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error('Could not find window.__remixContext in page HTML');
  }

  const start = markerIndex + marker.length;
  const endMarker = ';\nwindow.__remixRouteModules';
  const endIndex = html.indexOf(endMarker, start);
  if (endIndex === -1) {
    throw new Error('Could not locate end of remix context payload');
  }

  return html.slice(start, endIndex).trim();
}

function getProjectFromRemixContext(remixContext) {
  const candidates = [
    'routes/library.project.$projectSlug',
    'routes/library.$projectSlug',
    'routes/_index',
  ];

  const loaderData = remixContext?.state?.loaderData || {};
  for (const key of candidates) {
    const value = loaderData[key];
    if (value?.project) {
      return value.project;
    }
    if (value?.tracks && value?.title) {
      return value;
    }
  }

  for (const key of Object.keys(loaderData)) {
    const value = loaderData[key];
    if (value?.project?.tracks || value?.project?.title) {
      return value.project;
    }
  }

  throw new Error('Unable to locate project payload in remix context');
}

function extractProjectUrlsFromLibraryHtml(html) {
  const matches = html.matchAll(/href=["']([^"']+)["']/g);
  const urls = new Set();

  for (const match of matches) {
    const href = match[1];
    if (!href) continue;

    if (href.startsWith('/library/project/')) {
      urls.add(new URL(href, 'https://untitled.stream').toString());
      continue;
    }

    if (href.startsWith('https://untitled.stream/library/project/')) {
      urls.add(href);
    }
  }

  return Array.from(urls);
}

function objectKeyFromFallbackUrl(audioFallbackUrl) {
  const parsed = new URL(audioFallbackUrl);
  const marker = '/objects/';
  const idx = parsed.pathname.indexOf(marker);
  if (idx !== -1) {
    return parsed.pathname.slice(idx + marker.length);
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Cannot derive object key from audio_fallback_url: ${audioFallbackUrl}`);
  }
  return parts[parts.length - 1];
}

async function resolveSignedAudioUrl(audioFallbackUrl) {
  const objectKey = objectKeyFromFallbackUrl(audioFallbackUrl);
  const url = SIGNED_URL_API.replace('{MUSIC_URL}', encodeURIComponent(objectKey));

  const res = await fetch(url, {
    headers: {
      'user-agent': 'wstprtradio-sync/1.0',
      ...(UNTITLED_COOKIE ? { cookie: UNTITLED_COOKIE } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Signed URL lookup failed (${res.status})`);
  }

  const data = await res.json();
  if (!data?.url) {
    throw new Error('Signed URL response missing url');
  }

  return data.url;
}

async function downloadToFile(url, outputFilePath) {
  const res = await fetch(url, { headers: { 'user-agent': 'wstprtradio-sync/1.0' } });
  if (!res.ok || !res.body) {
    throw new Error(`Audio download failed (${res.status})`);
  }

  await pipeline(res.body, createWriteStream(outputFilePath));
}

async function withConcurrency(items, concurrency, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
      await sleep(50);
    }
  });

  await Promise.all(workers);
}

async function maybeApiLogin() {
  if (!API_ADMIN_USER || !API_ADMIN_PASS) return '';

  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: API_ADMIN_USER, password: API_ADMIN_PASS }),
  });

  if (!res.ok) {
    throw new Error(`API login failed (${res.status})`);
  }

  const setCookie = res.headers.get('set-cookie') || '';
  const cookiePair = setCookie.split(';')[0];
  return cookiePair || '';
}

async function uploadBatch(files, apiCookie) {
  const form = new FormData();

  for (const filePath of files) {
    const bytes = readFileSync(filePath);
    const blob = new Blob([bytes], { type: mimeForFile(filePath) });
    form.append('file', blob, basename(filePath));
  }

  const headers = {};
  if (apiCookie) headers.cookie = apiCookie;

  const res = await fetch(`${API_BASE_URL}/admin/songs/upload`, {
    method: 'POST',
    headers,
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed (${res.status}): ${body.slice(0, 300)}`);
  }

  return res.json();
}

function mimeForFile(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.flac':
      return 'audio/flac';
    case '.ogg':
    case '.oga':
      return 'audio/ogg';
    case '.m4a':
      return 'audio/mp4';
    default:
      return 'application/octet-stream';
  }
}

function collectProjectUrls() {
  const direct = (process.env.UNTITLED_PROJECT_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (direct.length > 0) return direct;

  const filePath = process.env.UNTITLED_URLS_FILE;
  if (filePath) {
    const raw = readFileSync(resolve(filePath), 'utf8');
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('#'));
  }

  return null;
}

async function main() {
  mkdirSync(UNTITLED_OUTPUT_DIR, { recursive: true });

  let projectUrls = collectProjectUrls();

  if (!projectUrls) {
    console.log(`Fetching library page: ${UNTITLED_LIBRARY_URL}`);
    const libraryHtml = await fetchText(UNTITLED_LIBRARY_URL);
    projectUrls = extractProjectUrlsFromLibraryHtml(libraryHtml);
  }

  if (!projectUrls || projectUrls.length === 0) {
    throw new Error('No project URLs found. Provide UNTITLED_PROJECT_URLS/UNTITLED_URLS_FILE or a valid UNTITLED_LIBRARY_URL with access.');
  }

  console.log(`Found ${projectUrls.length} project(s)`);

  const downloadPlan = [];

  for (const projectUrl of projectUrls) {
    console.log(`Reading project: ${projectUrl}`);
    const html = await fetchText(projectUrl);
    const remixContextJson = extractRemixContextJson(html);
    const remixContext = JSON.parse(remixContextJson);
    const project = getProjectFromRemixContext(remixContext);

    const projectTitle = sanitizeName(project?.title || 'untitled-project');
    const projectDir = join(UNTITLED_OUTPUT_DIR, projectTitle);
    mkdirSync(projectDir, { recursive: true });

    const tracks = Array.isArray(project?.tracks) ? project.tracks : [];

    for (const track of tracks) {
      if (!track?.audio_fallback_url || !track?.title) continue;
      const filename = `${sanitizeName(track.title)}.mp3`;
      const targetPath = join(projectDir, filename);
      downloadPlan.push({
        projectTitle,
        trackTitle: track.title,
        audioFallbackUrl: track.audio_fallback_url,
        targetPath,
      });
    }
  }

  if (downloadPlan.length === 0) {
    throw new Error('No downloadable tracks discovered in supplied projects.');
  }

  console.log(`Prepared ${downloadPlan.length} track(s)`);

  if (UNTITLED_DRY_RUN) {
    for (const item of downloadPlan.slice(0, 20)) {
      console.log(`[dry-run] ${item.projectTitle} :: ${item.trackTitle} -> ${item.targetPath}`);
    }
    console.log('[dry-run] Skipped downloading and uploading.');
    return;
  }

  const downloadedFiles = [];

  await withConcurrency(downloadPlan, UNTITLED_MAX_CONCURRENCY, async (item) => {
    if (existsSync(item.targetPath)) {
      downloadedFiles.push(item.targetPath);
      console.log(`Skip existing: ${item.targetPath}`);
      return;
    }

    const signedUrl = await resolveSignedAudioUrl(item.audioFallbackUrl);
    await downloadToFile(signedUrl, item.targetPath);
    downloadedFiles.push(item.targetPath);
    console.log(`Downloaded: ${item.trackTitle}`);
  });

  const apiCookie = await maybeApiLogin();

  let uploaded = 0;
  for (let i = 0; i < downloadedFiles.length; i += UNTITLED_UPLOAD_BATCH_SIZE) {
    const batch = downloadedFiles.slice(i, i + UNTITLED_UPLOAD_BATCH_SIZE);
    await uploadBatch(batch, apiCookie);
    uploaded += batch.length;
    console.log(`Uploaded batch (${uploaded}/${downloadedFiles.length})`);
  }

  console.log('Sync complete.');
  console.log(`Local files: ${downloadedFiles.length}`);
  console.log(`Uploaded files: ${uploaded}`);
}

main().catch((error) => {
  console.error(`Sync failed: ${error?.message || error}`);
  process.exit(1);
});
