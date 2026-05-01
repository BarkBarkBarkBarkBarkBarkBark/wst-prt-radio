'use client';

import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BadDogStamp } from '@/components/BadDogStamp';
import { VinylRecord } from '@/components/VinylRecord';
import { ChatPanel } from '@/components/ChatPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { InkyHalo } from '@/components/InkyHalo';
import { useAudio } from '@/lib/AudioProvider';

export default function HomePage() {
  const { status, amplitude, enabled, setEnabled } = useAudio();
  const stationState = status?.stationState ?? 'open';
  const listeners    = status?.listenerCount ?? 0;
  const broadcaster  = status?.broadcasterDisplayName ?? 'open channel';

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col relative">
      {/* Inky starlight vignette — fixed, non-interactive */}
      <InkyHalo />

      <div className="relative z-10 flex flex-col flex-1">
        <Header />

        <main className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full flex flex-col gap-6">

          {/* ── Hero panel ──────────────────────────────────────────────── */}
          <section className="border border-ink/12 bg-white/75 candle-card">
            <div className="grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1fr]">

              {/* Left: title + cta */}
              <div className="order-2 space-y-6 lg:order-1">
                <div className="space-y-3">
                  <p className="text-[0.6rem] uppercase tracking-[0.45em] text-muted font-mono">
                    Neon vinyl&nbsp;/&nbsp;low orbit&nbsp;/&nbsp;analog dream
                  </p>
                  <h1 className="text-5xl font-bold uppercase tracking-[0.15em] text-ink leading-none sm:text-6xl">
                    West Port<br />Radio
                  </h1>
                  <p className="text-[0.68rem] uppercase tracking-[0.38em] text-muted font-mono">
                    Hit page. Hear signal. Leave it open.
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <StatusBadge state={stationState} />
                  <span className="text-[0.65rem] font-mono uppercase tracking-[0.25em] text-muted">
                    {listeners}&nbsp;listening&nbsp;·&nbsp;{broadcaster}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className="border border-ink bg-ink px-7 py-3 text-sm font-bold uppercase tracking-[0.28em] text-paper transition-colors hover:border-accent-red hover:bg-accent-red"
                  >
                    {enabled ? 'Pause' : 'Play'}
                  </button>
                  <Link
                    href="/stream"
                    className="border border-ink/40 px-6 py-3 text-xs font-bold uppercase tracking-[0.28em] text-ink transition-colors hover:border-accent-red hover:text-accent-red"
                  >
                    Go Live
                  </Link>
                  <Link
                    href="/admin"
                    className="border border-ink/20 px-5 py-3 text-xs font-bold uppercase tracking-[0.28em] text-muted transition-colors hover:border-muted hover:text-ink"
                  >
                    Admin
                  </Link>
                </div>
              </div>

              {/* Right: vinyl record */}
              <div className="order-1 lg:order-2 flex justify-center">
                <VinylRecord
                  isLive={stationState === 'live'}
                  amplitude={amplitude}
                  isPlaying={enabled}
                />
              </div>
            </div>
          </section>

          {/* ── Chat panel ──────────────────────────────────────────────── */}
          <section className="border border-ink/12 bg-white/75 candle-card-alt overflow-hidden">
            <ChatPanel listenerCount={listeners} />
          </section>

        </main>

        <Footer />
        <BadDogStamp />
      </div>
    </div>
  );
}
