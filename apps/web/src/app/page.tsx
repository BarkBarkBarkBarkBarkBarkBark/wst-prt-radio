'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { VinylRecord } from '@/components/VinylRecord';
import { InkyHalo } from '@/components/InkyHalo';
import { useAudio } from '@/lib/AudioProvider';

export default function HomePage() {
  const { status, amplitude, enabled, setEnabled, playlist, currentFallbackIndex, skipTrack } = useAudio();
  const stationState = status?.stationState ?? 'open';
  const listeners = status?.listenerCount ?? 0;

  const currentTrack = playlist?.tracks[currentFallbackIndex];

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col relative">
      <InkyHalo />
      <div className="relative z-10 flex flex-col flex-1">
        <Header />

        <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full flex items-center justify-center">
          <section className="w-full border border-ink/12 bg-white/75 candle-card">
            <div className="flex flex-col items-center gap-8 px-6 py-10 text-center sm:px-10 sm:py-14">
              <div className="space-y-3">
                <p className="text-[0.62rem] uppercase tracking-[0.42em] text-muted font-mono">West Port Radio</p>
                <h1 className="text-5xl font-bold uppercase tracking-[0.18em] text-ink leading-none sm:text-6xl">
                  Play
                </h1>
                <div className="flex items-center justify-center gap-4 text-[0.65rem] font-mono uppercase tracking-[0.25em] text-muted">
                  <span>{stationState === 'live' ? 'Live' : 'On Air'}</span>
                  <span>{listeners} listening</span>
                </div>
              </div>

              <VinylRecord isLive={stationState === 'live'} amplitude={amplitude} isPlaying={enabled} />

              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className="border border-ink bg-ink px-10 py-4 text-sm font-bold uppercase tracking-[0.32em] text-paper transition-colors hover:border-accent-red hover:bg-accent-red"
                  >
                    {enabled ? 'Pause' : 'Play'}
                  </button>

                  <button
                    type="button"
                    onClick={skipTrack}
                    className="border border-ink/40 px-6 py-4 text-xs font-bold uppercase tracking-[0.28em] text-ink transition-colors hover:border-accent-red hover:text-accent-red"
                  >
                    Skip
                  </button>
                </div>

                <p className="min-h-[1rem] text-xs font-mono text-muted truncate max-w-md">
                  {currentTrack ? currentTrack.title : ''}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted">Random track each play for discovery</p>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </div>
  );
}
