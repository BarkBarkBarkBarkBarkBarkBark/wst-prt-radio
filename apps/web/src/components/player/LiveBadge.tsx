export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      Live
    </span>
  );
}
