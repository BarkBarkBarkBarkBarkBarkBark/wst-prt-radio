#!/usr/bin/env node
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const SRC_DIR = resolve(process.argv[2] || './songs');
const DELETE_WAV = (process.env.DELETE_WAV || '').trim() === '1';
const BITRATE = process.env.MP3_BITRATE || '192k';
const WAV_EXTENSIONS = new Set(['.wav']);

function collectWavs(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectWavs(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!WAV_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    files.push(fullPath);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function convertOne(inputPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    const outputPath = inputPath.replace(/\.wav$/i, '.mp3');
    if (existsSync(outputPath) && statSync(outputPath).size > 0) {
      resolvePromise({ inputPath, outputPath, skipped: true });
      return;
    }

    const child = spawn(ffmpegPath, [
      '-y',
      '-i', inputPath,
      '-codec:a', 'libmp3lame',
      '-b:a', BITRATE,
      outputPath,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => rejectPromise(error));
    child.on('close', (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`ffmpeg exited ${code} for ${inputPath}\n${stderr.slice(-800)}`));
        return;
      }
      if (DELETE_WAV) {
        unlinkSync(inputPath);
      }
      resolvePromise({ inputPath, outputPath, skipped: false });
    });
  });
}

async function main() {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static did not resolve a binary path.');
  }
  const wavs = collectWavs(SRC_DIR);
  console.log(`WAV files: ${wavs.length}`);
  for (let index = 0; index < wavs.length; index += 1) {
    const result = await convertOne(wavs[index]);
    console.log(`${result.skipped ? 'Skipped' : 'Converted'} ${index + 1}/${wavs.length}: ${result.outputPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
