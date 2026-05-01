'use client';

import Link from 'next/link';
import { PublicShell } from '@/components/PublicShell';
import { StatusBadge } from '@/components/StatusBadge';
import { VinylRecord } from '@/components/VinylRecord';
import { useStationStatus } from '@/lib/hooks/useStationStatus';

export default function HomePage() {
  const { data: status } = useStationStatus();
  const state = status?.stationState ?? 'open';

  return (
    <PublicShell>
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[2.5rem] border border-stone-300/70 bg-white/80 px-6 py-8 shadow-sm sm:px-10 sm:py-12">
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="order-2 space-y-5 lg:order-1">
              <StatusBadge state={state} />
              <div className="space-y-3">
                <p className="text-[0.65rem] uppercase tracking-[0.4em] text-muted">Neon vinyl / low orbit / analog dream</p>
                <h1 className="text-4xl font-semibold uppercase tracking-[0.18em] text-ink sm:text-5xl">
                  West Port Radio
                </h1>
                <p className="text-sm uppercase tracking-[0.35em] text-muted">Tokyo static. Kansas City heart. Space bar glow.</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/listen"
                  className="rounded-full border border-ink bg-ink px-7 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-paper transition hover:border-accent-red hover:bg-accent-red"
                >
                  Drop the needle
                </Link>
                <Link
                  href="/stream"
                  className="rounded-full border border-stone-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-ink transition hover:border-accent-red hover:text-accent-red"
                >
                  Go live
                </Link>
              </div>

              <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.24em] text-muted">
                <span>{status?.listenerCount ?? 0} listening</span>
                <span>{status?.broadcasterDisplayName ?? 'open channel'}</span>
              </div>
            </div>

            <Link
              href="/listen"
              aria-label="Open the listener page"
              className="order-1 block transition-transform duration-300 hover:scale-[1.02] lg:order-2"
            >
              <VinylRecord isLive={state === 'live'} />
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Link href="/listen" className="rounded-[2rem] border border-stone-300/70 bg-paper/90 p-6 transition hover:border-accent-red/50">
            <p className="text-[0.65rem] uppercase tracking-[0.34em] text-muted">Listen</p>
          </Link>
          <Link href="/stream" className="rounded-[2rem] border border-stone-300/70 bg-paper/90 p-6 transition hover:border-accent-red/50">
            <p className="text-[0.65rem] uppercase tracking-[0.34em] text-muted">Stream</p>
          </Link>
          <Link href="/admin" className="rounded-[2rem] border border-stone-300/70 bg-paper/90 p-6 transition hover:border-accent-red/50">
            <p className="text-[0.65rem] uppercase tracking-[0.34em] text-muted">Admin</p>
          </Link>
        </section>
      </div>
    </PublicShell>
  );
}
