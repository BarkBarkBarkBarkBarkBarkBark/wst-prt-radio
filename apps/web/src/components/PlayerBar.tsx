'use client';

/**
 * PlayerBar — persistent Spotify-style fixed bottom audio bar.
 *
 * Always mounted in layout.tsx, shares audio state via AudioProvider.
 * Hard 90° edges, dark ink background, sound-reactive top border glow.
 */

import { useAudio } from '@/lib/AudioProvider';
import { VolumeKnob } from './VolumeKnob';

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

export function PlayerBar() {
  const {
    enabled,
    connected,
    message,
    status,
    volume,
    amplitude,
    setEnabled,
    handleVolumeChange,
  } = useAudio();

  const isLive      = !!status?.broadcasterPresent;
  const listeners   = status?.listenerCount ?? 0;

  // Strip "Always-on: " prefix for compact display
  const trackLine = message.startsWith('Always-on:')
    ? message.replace('Always-on: ', '')
    : message;

  // Sound-reactive accent on the top border
  const topGlow = amplitude > 0.04
    ? `0 -2px ${6 + amplitude * 18}px rgba(183,53,36,${0.18 + amplitude * 0.55})`
    : '0 -1px 0 rgba(255,255,255,0.07)';

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 h-[72px] bg-ink flex items-center gap-3 px-4 sm:px-6"
      style={{ boxShadow: topGlow, borderTop: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* ── Left: status + track info ── */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div
          className="w-1.5 h-1.5 flex-shrink-0"
          style={{
            background: isLive ? '#B73524' : 'rgba(255,255,255,0.18)',
            boxShadow: isLive
              ? `0 0 ${4 + amplitude * 10}px rgba(183,53,36,${0.6 + amplitude * 0.4})`
              : undefined,
          }}
        />
        <div className="min-w-0">
          <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-white/30 leading-none mb-0.5">
            {isLive ? 'live broadcast' : 'always-on'}
          </p>
          <p className="text-[11px] text-white/60 truncate font-mono leading-none">{trackLine}</p>
        </div>
      </div>

      {/* ── Center: play / pause ── */}
      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        className="w-10 h-10 flex items-center justify-center bg-paper text-ink hover:bg-accent-red hover:text-paper transition-colors flex-shrink-0"
        aria-label={enabled ? 'Pause' : 'Play'}
        style={{
          boxShadow: enabled && amplitude > 0.05
            ? `0 0 ${8 + amplitude * 16}px rgba(183,53,36,${0.3 + amplitude * 0.4})`
            : undefined,
        }}
      >
        {enabled ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* ── Right: volume + signal ── */}
      <div className="flex-1 flex items-center justify-end gap-3">
        <span className="hidden sm:block text-[9px] font-mono uppercase tracking-[0.2em] text-white/25">
          {listeners}&nbsp;{listeners === 1 ? 'ear' : 'ears'}
        </span>
        {connected && (
          <span className="hidden lg:block text-[8px] font-mono text-white/18 uppercase tracking-widest">
            ▲&nbsp;signal
          </span>
        )}
        <VolumeKnob value={volume} onChange={handleVolumeChange} size={48} label="" />
      </div>
    </div>
  );
}
