'use client';

import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BadDogStamp } from '@/components/BadDogStamp';
import { VinylRecord } from '@/components/VinylRecord';
import { StatusBadge } from '@/components/StatusBadge';
import { InkyHalo } from '@/components/InkyHalo';
import { useAudio } from '@/lib/AudioProvider';
import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  venue: string | null;
  ticket_url: string | null;
}

export default function HomePage() {
  const { status, amplitude, enabled, setEnabled, playlist, currentFallbackIndex } = useAudio();
  const stationState = status?.stationState ?? 'open';
  const listeners    = status?.listenerCount ?? 0;
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/public/events`)
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((d: { events?: Event[] }) => setEvents((d.events ?? []).slice(0, 3)))
      .catch(() => {});
  }, []);

  const currentTrack = playlist?.tracks[currentFallbackIndex];

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col relative">
      <InkyHalo />
      <div className="relative z-10 flex flex-col flex-1">
        <Header />

        <main className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full flex flex-col gap-8">

          {/* ── Hero / Radio Player ─────────────────────────────────────── */}
          <section className="border border-ink/12 bg-white/75 candle-card">
            <div className="grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1fr]">
              {/* Left: title + radio controls */}
              <div className="order-2 space-y-6 lg:order-1">
                <div className="space-y-3">
                  <p className="text-[0.6rem] uppercase tracking-[0.45em] text-muted font-mono">
                    Neon vinyl&nbsp;/&nbsp;low orbit&nbsp;/&nbsp;analog dream
                  </p>
                  <h1 className="text-5xl font-bold uppercase tracking-[0.15em] text-ink leading-none sm:text-6xl">
                    West Port<br />Radio
                  </h1>
                  <p className="text-[0.68rem] uppercase tracking-[0.38em] text-muted font-mono">
                    Pirate radio from Kansas City, Missouri
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <StatusBadge state={stationState} />
                  <span className="text-[0.65rem] font-mono uppercase tracking-[0.25em] text-muted">
                    {listeners}&nbsp;listening
                  </span>
                </div>

                {currentTrack && enabled && (
                  <p className="text-xs font-mono text-muted truncate">♪ {currentTrack.title}</p>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className="border border-ink bg-ink px-7 py-3 text-sm font-bold uppercase tracking-[0.28em] text-paper transition-colors hover:border-accent-red hover:bg-accent-red"
                  >
                    {enabled ? 'Pause' : 'Tune In'}
                  </button>
                  <Link
                    href="/events"
                    className="border border-ink/40 px-6 py-3 text-xs font-bold uppercase tracking-[0.28em] text-ink transition-colors hover:border-accent-red hover:text-accent-red"
                  >
                    Events
                  </Link>
                  <Link
                    href="/artists"
                    className="border border-ink/20 px-5 py-3 text-xs font-bold uppercase tracking-[0.28em] text-muted transition-colors hover:border-muted hover:text-ink"
                  >
                    Artists
                  </Link>
                </div>
              </div>

              {/* Right: vinyl */}
              <div className="order-1 lg:order-2 flex justify-center">
                <VinylRecord isLive={stationState === 'live'} amplitude={amplitude} isPlaying={enabled} />
              </div>
            </div>
          </section>

          {/* ── About ───────────────────────────────────────────────────── */}
          <section className="border border-ink/12 bg-white/75 candle-card p-6 sm:p-10 space-y-4">
            <h2 className="text-2xl font-bold uppercase tracking-[0.15em] text-ink">About the Station</h2>
            <p className="text-sm leading-7 text-muted max-w-3xl">
              West Port Radio is an independent pirate radio station broadcasting from Kansas City, Missouri.
              We play underground, local, and handpicked music around the clock — no algorithms, no ads, just signal.
              Tune in any time to hear what&apos;s on the air, or check our events page for live sessions and local shows.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              {[
                { label: 'Founded', value: '2024' },
                { label: 'Location', value: 'KC, Missouri' },
                { label: 'Format', value: 'Freeform' },
              ].map(({ label, value }) => (
                <div key={label} className="border border-ink/10 p-4">
                  <p className="text-[0.6rem] uppercase tracking-[0.35em] text-muted font-mono">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Upcoming Events preview ──────────────────────────────────── */}
          <section className="border border-ink/12 bg-white/75 candle-card p-6 sm:p-10 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold uppercase tracking-[0.15em] text-ink">Upcoming Events</h2>
              <Link href="/events" className="text-xs uppercase tracking-[0.28em] text-muted hover:text-accent-red transition-colors">
                All events →
              </Link>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-muted">No upcoming events scheduled — check back soon.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((ev) => (
                  <div key={ev.id} className="border border-ink/10 p-4 space-y-2">
                    <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted font-mono">
                      {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="font-semibold text-ink text-sm">{ev.title}</p>
                    {ev.venue && <p className="text-xs text-muted">{ev.venue}</p>}
                    {ev.ticket_url && (
                      <a href={ev.ticket_url} target="_blank" rel="noopener noreferrer"
                        className="inline-block text-[0.65rem] uppercase tracking-[0.25em] text-accent-red hover:underline">
                        Tickets →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

        </main>

        <Footer />
        <BadDogStamp />
      </div>
    </div>
  );
}
