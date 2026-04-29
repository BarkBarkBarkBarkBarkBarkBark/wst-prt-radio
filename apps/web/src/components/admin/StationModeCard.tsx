import type { StationMode, NowPlaying } from '@wstprtradio/shared';

const modeConfig: Record<StationMode, { label: string; color: string; bg: string }> = {
  autodj: { label: 'AutoDJ', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  live_audio: { label: 'Live Audio', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
  live_video: { label: 'Live Video', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
  degraded: { label: 'Degraded', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
};

interface StationModeCardProps {
  mode: StationMode;
  nowPlaying: NowPlaying | null;
}

export function StationModeCard({ mode, nowPlaying }: StationModeCardProps) {
  const config = modeConfig[mode];

  return (
    <div className={`rounded-xl border p-6 ${config.bg}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Station Mode</p>
      <p className={`text-2xl font-bold ${config.color}`}>{config.label}</p>
      {nowPlaying && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-sm text-white font-medium truncate">{nowPlaying.title}</p>
          <p className="text-xs text-gray-400 truncate">{nowPlaying.artist}</p>
        </div>
      )}
    </div>
  );
}
