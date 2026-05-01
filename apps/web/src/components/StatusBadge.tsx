import type { StationState } from '@wstprtradio/shared';

const LABELS: Record<StationState, string> = {
  closed: 'Closed',
  open: 'Open',
  live: 'Live',
  blocked: 'Blocked',
  degraded: 'Degraded',
};

const STYLES: Record<StationState, string> = {
  closed: 'border-stone-300 bg-stone-100 text-stone-700',
  open: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  live: 'border-red-300 bg-red-50 text-red-700',
  blocked: 'border-amber-300 bg-amber-50 text-amber-800',
  degraded: 'border-violet-300 bg-violet-50 text-violet-700',
};

export function StatusBadge({ state }: { state: StationState }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${STYLES[state]}`}>
      {LABELS[state]}
    </span>
  );
}
