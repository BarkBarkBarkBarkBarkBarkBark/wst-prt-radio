'use client';

import { useState } from 'react';
import { useNowPlaying } from '@/lib/hooks/useNowPlaying';
import { LiveBadge } from './LiveBadge';
import { ListenerCount } from './ListenerCount';

const STREAM_URL = process.env.NEXT_PUBLIC_API_BASE_URL
  ? `${process.env.NEXT_PUBLIC_API_BASE_URL?.replace('/api', '')}/radio.mp3`
  : 'https://radio.wstprtradio.com/radio.mp3';

export function PersistentPlayer() {
  const { data: nowPlaying } = useNowPlaying();
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => (typeof window !== 'undefined' ? new Audio() : null));

  function togglePlay() {
    if (!audio) return;
    if (playing) {
      audio.pause();
      audio.src = '';
      setPlaying(false);
    } else {
      audio.src = nowPlaying?.streamUrl ?? STREAM_URL;
      void audio.play();
      setPlaying(true);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          {nowPlaying ? (
            <>
              <p className="text-sm font-medium text-white truncate">{nowPlaying.title}</p>
              <p className="text-xs text-gray-400 truncate">{nowPlaying.artist}</p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Loading…</p>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {nowPlaying?.isLive && <LiveBadge />}
          {nowPlaying && <ListenerCount count={nowPlaying.listenersCount} />}
        </div>
      </div>
    </div>
  );
}
