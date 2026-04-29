'use client';

import { useState } from 'react';
import { useAudioStore } from '@/lib/audioStore';
import { useStationStatus } from '@/lib/hooks/useStationStatus';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { VinylRecord } from '@/components/VinylRecord';
import { AudioControls } from '@/components/AudioControls';
import { SpectrumAnalyzer } from '@/components/SpectrumAnalyzer';
import { ChatPanel } from '@/components/ChatPanel';
import { StationPanel } from '@/components/StationPanel';
import { BadDogStamp } from '@/components/BadDogStamp';

export default function HomePage() {
  const { isPlaying, isMuted, togglePlay, toggleMute } = useAudioStore();
  const [chatOpen, setChatOpen] = useState(true);
  const { data: status } = useStationStatus();

  const isLive = status?.mode === 'live_audio' || status?.mode === 'live_video';

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <Header />

      <main id="player" className="flex-1 px-4 pt-10 pb-16 w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-6 items-start">

          {/* ── Left column: station info + spectrum ── */}
          <div className="space-y-10 order-2 lg:order-1">
            <StationPanel />
            <SpectrumAnalyzer />
          </div>

          {/* ── Center column: vinyl + controls ── */}
          <div className="flex flex-col items-center gap-7 order-1 lg:order-2">
            <VinylRecord isPlaying={isPlaying} isLive={isLive} />
            <AudioControls
              isPlaying={isPlaying}
              isMuted={isMuted}
              chatOpen={chatOpen}
              onTogglePlay={togglePlay}
              onToggleMute={toggleMute}
              onToggleChat={() => setChatOpen((o: boolean) => !o)}
            />
          </div>

          {/* ── Right column: chat ── */}
          <div className="order-3">
            {chatOpen && <ChatPanel />}
          </div>

        </div>
      </main>

      <Footer />
      <BadDogStamp />
    </div>
  );
}
