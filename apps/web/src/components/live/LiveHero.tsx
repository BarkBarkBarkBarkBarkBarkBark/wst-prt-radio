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
        className={`${fullPage ? 'min-h-64' : ''} bg-paper-dark rounded-2xl border border-stone-200 p-8 animate-pulse`}
      />
    );
  }

  if (!isLive) {
    return (
      <div className="bg-paper-dark rounded-2xl border border-stone-200 p-8 text-center">
        <p className="text-muted">No live session right now.</p>
        <p className="text-sm text-muted/70 mt-1">AutoDJ is keeping you company.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-accent-red/20 p-8 space-y-4"
      style={{
        background: 'linear-gradient(135deg, #f9f0e8 0%, #fde8e1 100%)',
      }}
    >
      <div className="flex items-center gap-3">
        <LiveBadge />
        {isVideo && (
          <span className="text-xs text-accent-red border border-accent-red/30 rounded-full px-2.5 py-0.5">
            VIDEO
          </span>
        )}
      </div>

      {data?.liveSession && (
        <div>
          <h2 className="text-2xl font-bold text-ink">{data.liveSession.title}</h2>
          {data.liveSession.startedAt && (
            <p className="text-muted text-sm mt-1">
              Started {new Date(data.liveSession.startedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {data?.nowPlaying && (
        <div className="pt-2 border-t border-accent-red/10">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Now Playing</p>
          <p className="text-ink font-medium">{data.nowPlaying.title}</p>
          <p className="text-muted text-sm">{data.nowPlaying.artist}</p>
        </div>
      )}
    </div>
  );
}
