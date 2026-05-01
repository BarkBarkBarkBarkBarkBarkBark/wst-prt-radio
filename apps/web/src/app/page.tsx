'use client';

import Link from 'next/link';
import { PublicShell } from '@/components/PublicShell';
import { StatusBadge } from '@/components/StatusBadge';
import { useStationStatus } from '@/lib/hooks/useStationStatus';

export default function HomePage() {
  const { data: status } = useStationStatus();

  return (
    <PublicShell>
      <div className="space-y-8">
        <section className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-8 shadow-sm">
          <div className="space-y-4">
            <StatusBadge state={status?.stationState ?? 'closed'} />
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Dead-simple browser radio.</h1>
            <p className="max-w-3xl text-base leading-7 text-muted">
              Vercel serves the UI. Fly runs the control plane. Audio flows peer-to-peer in the browser with one broadcaster and a lightweight admin console.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/listen" className="rounded-full border border-ink bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:border-accent-red hover:bg-accent-red">
              Listen
            </Link>
            <Link href="/stream" className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-ink transition hover:border-accent-red hover:text-accent-red">
              Start streaming
            </Link>
            <Link href="/admin" className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-ink transition hover:border-accent-red hover:text-accent-red">
              Admin
            </Link>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-[2rem] border border-stone-300/70 bg-paper/90 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Station</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{status?.stationState ?? 'closed'}</p>
          </div>
          <div className="rounded-[2rem] border border-stone-300/70 bg-paper/90 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Listeners</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{status?.listenerCount ?? 0}</p>
          </div>
          <div className="rounded-[2rem] border border-stone-300/70 bg-paper/90 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Broadcaster</p>
            <p className="mt-3 text-xl font-semibold text-ink">{status?.broadcasterDisplayName ?? 'Nobody live'}</p>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
