interface VinylRecordProps {
  isLive?: boolean;
  sizeClassName?: string;
}

function AntennaIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <line x1="12" y1="2.5" x2="12" y2="8" />
      <line x1="8.5" y1="4.5" x2="12" y2="8" />
      <line x1="15.5" y1="4.5" x2="12" y2="8" />
      <line x1="12" y1="8" x2="12" y2="20.5" />
      <line x1="9" y1="20.5" x2="15" y2="20.5" />
    </svg>
  );
}

const GROOVE_INSETS = [20, 36, 52, 70, 88, 106, 124, 142];

export function VinylRecord({ isLive = false, sizeClassName = 'h-[22rem] w-[22rem] sm:h-[28rem] sm:w-[28rem]' }: VinylRecordProps) {
  return (
    <div className={`relative mx-auto ${sizeClassName}`}>
      <div
        className="absolute inset-[-12%] rounded-full opacity-80"
        style={{
          background:
            isLive
              ? 'radial-gradient(circle, rgba(183,53,36,0.18) 0%, rgba(183,53,36,0.08) 30%, transparent 70%)'
              : 'radial-gradient(circle, rgba(12,12,18,0.14) 0%, rgba(12,12,18,0.06) 38%, transparent 72%)',
        }}
      />

      <div
        className="relative flex h-full w-full items-center justify-center rounded-full border border-black/10 shadow-[0_30px_80px_rgba(0,0,0,0.22)]"
        style={{
          background:
            'radial-gradient(circle at 35% 28%, rgba(255,255,255,0.09) 0%, transparent 28%), radial-gradient(circle, #171717 0%, #0b0b0d 55%, #000 100%)',
          animation: 'vinylSpin 18s linear infinite',
        }}
      >
        {GROOVE_INSETS.map((inset) => (
          <div
            key={inset}
            className="absolute rounded-full border border-white/[0.05]"
            style={{ inset }}
          />
        ))}

        <div className="absolute inset-[10%] rounded-full border border-white/[0.04]" />

        <div className="relative z-10 flex h-28 w-28 flex-col items-center justify-center rounded-full border border-black/10 bg-accent-red text-paper shadow-inner sm:h-36 sm:w-36">
          <span className="text-[0.55rem] font-bold uppercase tracking-[0.32em] sm:text-[0.62rem]">
            West Port
          </span>
          <span className="mt-1 text-[0.52rem] uppercase tracking-[0.22em] text-paper/80 sm:text-[0.6rem]">
            Orbit Bar
          </span>
          <div className="my-1.5 text-paper/90 sm:my-2">
            <AntennaIcon />
          </div>
          <span className="text-[0.45rem] uppercase tracking-[0.3em] text-paper/70 sm:text-[0.5rem]">
            KC → Void
          </span>
        </div>

        <div className="absolute z-20 h-3 w-3 rounded-full bg-black" />
      </div>
    </div>
  );
}