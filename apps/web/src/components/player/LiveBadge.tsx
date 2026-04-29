export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-accent-red/10 text-accent-red border border-accent-red/30 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-live-pulse" />
      Live
    </span>
  );
}
