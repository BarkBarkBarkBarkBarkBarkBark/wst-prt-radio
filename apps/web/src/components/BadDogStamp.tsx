function PawIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Main pad */}
      <ellipse cx="12" cy="17.5" rx="4.5" ry="3.5" />
      {/* Toe beans */}
      <ellipse cx="6.5" cy="13" rx="2.2" ry="2.5" />
      <ellipse cx="17.5" cy="13" rx="2.2" ry="2.5" />
      <ellipse cx="9" cy="8.5" rx="2" ry="2.5" />
      <ellipse cx="15" cy="8.5" rx="2" ry="2.5" />
    </svg>
  );
}

export function BadDogStamp() {
  return (
    <div
      className="fixed bottom-[88px] right-4 z-50 pointer-events-none select-none"
      style={{ transform: 'rotate(-9deg)' }}
      aria-hidden="true"
    >
      <div
        className="w-[76px] h-[76px] rounded-full flex flex-col items-center justify-center gap-0.5"
        style={{
          border: '3px solid #B73524',
          opacity: 0.55,
        }}
      >
        <PawIcon className="w-4 h-4 text-accent-red" />
        <span
          className="text-[13px] font-bold leading-none"
          style={{ color: '#B73524' }}
        >
          悪い犬
        </span>
        <span
          className="text-[7px] tracking-widest uppercase leading-none"
          style={{ color: '#B73524' }}
        >
          Bad Dog
        </span>
      </div>
    </div>
  );
}
