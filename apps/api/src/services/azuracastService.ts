import type { NowPlaying } from '@wstprtradio/shared';
import { env } from '../lib/env.js';

interface AzuraNowPlayingResponse {
  now_playing: {
    song: {
      title: string;
      artist: string;
      album: string;
      art: string;
    };
  };
  listeners: {
    current: number;
  };
  live: {
    is_live: boolean;
  };
  station: {
    listen_url: string;
  };
}

let latestNowPlaying: NowPlaying | null = null;
let liveDjConnected = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

function buildStaticNowPlaying(): NowPlaying {
  return {
    title: env.STATIC_NOW_PLAYING_TITLE,
    artist: env.STATIC_NOW_PLAYING_ARTIST,
    listenersCount: 0,
    isLive: false,
    streamUrl: env.STREAM_PUBLIC_URL,
    ...(env.STATIC_NOW_PLAYING_ALBUM ? { album: env.STATIC_NOW_PLAYING_ALBUM } : {}),
  };
}

export function isLegacyAzuraCastConfigured(): boolean {
  return Boolean(env.AZURACAST_BASE_URL && env.AZURACAST_PUBLIC_API_URL);
}

export function usesLegacyAzuraCastMetadata(): boolean {
  return env.STREAM_METADATA_PROVIDER === 'azuracast' && Boolean(env.AZURACAST_PUBLIC_API_URL);
}

export function getStreamMetadataProvider(): 'static' | 'azuracast' {
  return usesLegacyAzuraCastMetadata() ? 'azuracast' : 'static';
}

async function fetchNowPlaying(): Promise<void> {
  try {
    const url = `${env.AZURACAST_PUBLIC_API_URL}/nowplaying/${env.AZURACAST_STATION_ID}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'wstprtradio/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`[azuracast] HTTP ${response.status} from ${url}`);
      return;
    }

    const data = (await response.json()) as AzuraNowPlayingResponse;

    liveDjConnected = data.live?.is_live ?? false;

    latestNowPlaying = {
      title: data.now_playing?.song?.title ?? 'Unknown',
      artist: data.now_playing?.song?.artist ?? 'Unknown',
      listenersCount: data.listeners?.current ?? 0,
      isLive: liveDjConnected,
      streamUrl: env.AZURACAST_PUBLIC_STREAM_URL || env.STREAM_PUBLIC_URL,
      ...(data.now_playing?.song?.album ? { album: data.now_playing.song.album } : {}),
      ...(data.now_playing?.song?.art ? { artUrl: data.now_playing.song.art } : {}),
    };
  } catch (err) {
    console.error('[azuracast] Poll error:', err);
  }
}

export function startPolling(): void {
  if (pollInterval) return;
  if (!usesLegacyAzuraCastMetadata()) {
    latestNowPlaying = buildStaticNowPlaying();
    return;
  }
  void fetchNowPlaying();
  pollInterval = setInterval(() => void fetchNowPlaying(), 10_000);
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

export function getLatestNowPlaying(): NowPlaying | null {
  return latestNowPlaying ?? buildStaticNowPlaying();
}

export function isLiveDjConnected(): boolean {
  return usesLegacyAzuraCastMetadata() ? liveDjConnected : false;
}
