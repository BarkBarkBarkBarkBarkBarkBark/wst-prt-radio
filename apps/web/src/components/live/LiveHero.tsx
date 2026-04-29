'use client';

import { useStationStatus } from '@/lib/hooks/useStationStatus';
import { LiveBadge } from '../player/LiveBadge';

interface LiveHeroProps {
  fullPage?: boolean;
}

export function LiveHero({ fullPage = false }: LiveHeroProps) {
  const { data, loading } = useStationStatus();

  const isLive = data?.mode === 'live_video' || data?.mode === 'live_audio';
  const isVideo = data?.mode === 'live_video';

  if (loading) {
    return (
      <div
        className={`${fullPage ? 'min-h-64' : ''} bg-gray-900 rounded-2xl border border-gray-800 p-8 animate-pulse`}
      />
    );
  }

  if (!isLive) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center">
        <p className="text-gray-500">No live session right now.</p>
        <p className="text-sm text-gray-600 mt-1">AutoDJ is keeping you company.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-950 to-gray-900 rounded-2xl border border-indigo-800/50 p-8 space-y-4">
      <div className="flex items-center gap-3">
        <LiveBadge />
        {isVideo && (
          <span className="text-xs text-indigo-400 border border-indigo-700/50 rounded-full px-2.5 py-0.5">
            VIDEO
          </span>
        )}
      </div>

      {data?.liveSession && (
        <div>
          <h2 className="text-2xl font-bold text-white">{data.liveSession.title}</h2>
          {data.liveSession.startedAt && (
            <p className="text-gray-400 text-sm mt-1">
              Started {new Date(data.liveSession.startedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {data?.nowPlaying && (
        <div className="pt-2 border-t border-white/10">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Now Playing</p>
          <p className="text-white font-medium">{data.nowPlaying.title}</p>
          <p className="text-gray-400 text-sm">{data.nowPlaying.artist}</p>
        </div>
      )}
    </div>
  );
}
