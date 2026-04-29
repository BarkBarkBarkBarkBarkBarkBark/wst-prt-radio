'use client';

import { useNowPlaying } from '@/lib/hooks/useNowPlaying';
import { useStationStatus } from '@/lib/hooks/useStationStatus';

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-accent-red font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-live-pulse" />
      Live
    </span>
  );
}

function AutoDJDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-muted">
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
      AutoDJ
    </span>
  );
}

export function StationPanel() {
  const { data: nowPlaying } = useNowPlaying();
  const { data: status } = useStationStatus();

  const isLive = status?.mode === 'live_audio' || status?.mode === 'live_video';

  // Fall back to manifest example copy when API isn't reachable yet
  const title = nowPlaying?.title ?? 'Barking at the Moon';
  const artist = nowPlaying?.artist ?? 'Doggos in Space';
  const program = 'West Port Residency';
  const listeners = nowPlaying?.listenersCount;

  return (
    <div className="space-y-6">
      {/* Live / AutoDJ status */}
      <div>{isLive ? <LiveDot /> : <AutoDJDot />}</div>

      {/* Now playing */}
      <div className="space-y-1 border-t border-stone-200 pt-5">
        <p className="text-[10px] tracking-[0.22em] uppercase text-muted">Now Playing</p>
        <p className="text-xl font-semibold text-ink leading-snug">{title}</p>
        <p className="text-sm text-muted">{artist}</p>
        <p className="text-xs text-muted/70 italic">{program}</p>
        {listeners !== undefined && listeners > 0 && (
          <p className="text-xs text-muted pt-1">{listeners.toLocaleString()} listening</p>
        )}
      </div>
    </div>
  );
}
