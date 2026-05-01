'use client';

/**
 * PlayerBar — persistent Spotify-style fixed bottom audio bar.
 *
 * Styled with a warm wood-grain SVG texture, 1px solid black border top,
 * sound-reactive accent glow on the play button and border.
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

// Warm wood-grain SVG data URI (subtle horizontal grain lines)
const WOOD_GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='72'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04 0.6' numOctaves='4' seed='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0.18'/%3E%3C/filter%3E%3Crect width='400' height='72' filter='url(%23g)' opacity='0.55'/%3E%3C/svg%3E")`;

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

  const isLive    = !!status?.broadcasterPresent;
  const listeners = status?.listenerCount ?? 0;

  const trackLine = message.startsWith('Always-on:')
    ? message.replace('Always-on: ', '')
    : message;

  // Sound-reactive glow on the top border
  const glowAlpha  = amplitude > 0.04 ? (0.25 + amplitude * 0.5).toFixed(2) : '0';
  const glowSpread = amplitude > 0.04 ? Math.round(4 + amplitude * 14) : 0;
  const borderGlow = amplitude > 0.04
    ? `0 -2px ${glowSpread}px rgba(183,53,36,${glowAlpha})`
    : 'none';

  // Play button glow when active + loud
  const btnGlow = enabled && amplitude > 0.06
    ? `0 0 ${8 + amplitude * 14}px rgba(183,53,36,${0.35 + amplitude * 0.4})`
    : 'none';

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 h-[72px] flex items-center gap-3 px-4 sm:px-6"
      style={{
        // Warm dark wood base + grain overlay
        background: `${WOOD_GRAIN_BG}, linear-gradient(180deg, #2a1f14 0%, #1c140c 50%, #130e08 100%)`,
        borderTop: '1px solid #000',
        boxShadow: borderGlow !== 'none' ? borderGlow : '0 -1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* ── Left: status dot + track info ── */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div
          className="w-1.5 h-1.5 flex-shrink-0 rounded-sm"
          style={{
            background: isLive ? '#B73524' : 'rgba(255,220,160,0.25)',
            boxShadow: isLive
              ? `0 0 ${4 + amplitude * 10}px rgba(183,53,36,${0.55 + amplitude * 0.45})`
              : undefined,
          }}
        />
        <div className="min-w-0">
          <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-amber-900/60 leading-none mb-0.5">
            {isLive ? 'live broadcast' : 'always-on'}
          </p>
          <p className="text-[11px] text-amber-100/50 truncate font-mono leading-none">{trackLine}</p>
        </div>
      </div>

      {/* ── Center: play / pause — softened with rounded-sm ── */}
      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        className="w-10 h-10 flex items-center justify-center rounded-sm text-amber-100 transition-colors flex-shrink-0"
        aria-label={enabled ? 'Pause' : 'Play'}
        style={{
          background: enabled
            ? `rgba(183,53,36,${0.75 + amplitude * 0.25})`
            : 'rgba(255,220,160,0.12)',
          boxShadow: btnGlow,
          border: '1px solid rgba(255,220,160,0.1)',
        }}
      >
        {enabled ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* ── Right: listener count + signal + volume ── */}
      <div className="flex-1 flex items-center justify-end gap-3">
        <span className="hidden sm:block text-[9px] font-mono uppercase tracking-[0.2em] text-amber-100/25">
          {listeners}&nbsp;{listeners === 1 ? 'ear' : 'ears'}
        </span>
        {connected && (
          <span className="hidden lg:block text-[8px] font-mono text-amber-100/15 uppercase tracking-widest">
            ▲&nbsp;signal
          </span>
        )}
        <VolumeKnob value={volume} onChange={handleVolumeChange} size={48} label="" />
      </div>
    </div>
  );
}
