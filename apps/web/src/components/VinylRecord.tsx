'use client';

interface VinylRecordProps {
  isPlaying: boolean;
  isLive?: boolean;
}

function AntennaIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="w-3.5 h-3.5"
      aria-hidden="true"
    >
      <line x1="12" y1="2" x2="12" y2="8" />
      <line x1="8" y1="4" x2="12" y2="8" />
      <line x1="16" y1="4" x2="12" y2="8" />
      <line x1="12" y1="8" x2="12" y2="22" />
    </svg>
  );
}

const GROOVE_INSETS = [20, 44, 66, 86, 104, 118];

export function VinylRecord({ isPlaying, isLive }: VinylRecordProps) {
  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Soft red glow during live broadcast */}
      {isLive && (
        <div
          className="absolute inset-0 rounded-full animate-live-pulse"
          style={{
            background:
              'radial-gradient(circle, rgba(183,53,36,0.22) 0%, transparent 72%)',
            transform: 'scale(1.2)',
          }}
        />
      )}

      {/* The record */}
      <div
        className="relative w-72 h-72 rounded-full shadow-2xl flex items-center justify-center"
        style={{
          backgroundColor: '#080808',
          animation: 'vinylSpin 22s linear infinite',
          animationPlayState: isPlaying ? 'running' : 'paused',
        }}
      >
        {/* Vinyl grooves */}
        {GROOVE_INSETS.map((inset) => (
          <div
            key={inset}
            className="absolute rounded-full border border-white/[0.04]"
            style={{ inset: `${inset}px` }}
          />
        ))}

        {/* Specular highlight */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 38% 28%, rgba(255,255,255,0.07) 0%, transparent 55%)',
          }}
        />

        {/* Red center label */}
        <div
          className="relative z-10 w-[88px] h-[88px] rounded-full flex flex-col items-center justify-center gap-0.5 shadow-inner"
          style={{ backgroundColor: '#B73524' }}
        >
          <span className="text-white text-[8px] font-bold tracking-[0.14em] uppercase leading-none">
            WEST PORT
          </span>
          <span className="text-white text-[8px] font-bold tracking-[0.14em] uppercase leading-none">
            RADIO
          </span>
          <div className="text-white/80 my-0.5">
            <AntennaIcon />
          </div>
          <span className="text-white/70 text-[7px] tracking-wide leading-none">
            KC, MO
          </span>
        </div>

        {/* Center spindle hole */}
        <div className="absolute z-20 w-3 h-3 rounded-full bg-black pointer-events-none" />
      </div>
    </div>
  );
}
