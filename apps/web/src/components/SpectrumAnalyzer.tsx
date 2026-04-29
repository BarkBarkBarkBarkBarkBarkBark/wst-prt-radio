// Deterministic bar heights for SSR/CSR consistency.
// Visual pattern: wave-like with variation so it looks organic.
const BAR_HEIGHTS = [
  35, 55, 72, 45, 82, 60, 28, 74, 50, 65, 38, 86, 55, 28, 68, 44,
  60, 80, 33, 66, 50, 76, 40, 54, 72, 30, 84, 58, 44, 70, 36, 56,
];

// Bar color: strongest (>65%) = accent-red, medium = dark gray, low = lighter gray
function barColor(height: number): string {
  if (height > 65) return '#B73524';
  if (height > 42) return '#3a3530';
  return '#7a736a';
}

export function SpectrumAnalyzer() {
  return (
    <div className="space-y-2">
      <p className="text-[10px] tracking-[0.22em] uppercase text-muted">Signal</p>
      <div className="flex items-end gap-[2px] h-10">
        {BAR_HEIGHTS.map((height, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[1px] animate-bar-pulse"
            style={{
              height: `${height}%`,
              backgroundColor: barColor(height),
              animationDelay: `${(i % 8) * 0.11}s`,
              animationDuration: `${0.55 + (i % 6) * 0.14}s`,
              transformOrigin: 'bottom',
            }}
          />
        ))}
      </div>
    </div>
  );
}
