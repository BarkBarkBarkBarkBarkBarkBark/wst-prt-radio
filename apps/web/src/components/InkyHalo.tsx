'use client';

/**
 * InkyHalo — full-screen velvety dark vignette overlay.
 *
 * Creates the "black starlight" effect: edges of the page fade to deep ink,
 * with a slow pulsating animation and sound-reactive intensification.
 * Non-interactive (pointer-events: none), z-index 1 (below content, above bg).
 */

import { useAudio } from '@/lib/AudioProvider';

export function InkyHalo() {
  const { amplitude, enabled } = useAudio();

  // When playing, the halo breathes with the audio amplitude
  const baseOpacity  = 0.55;
  const extraOpacity = enabled ? amplitude * 0.3 : 0;
  const opacity      = baseOpacity + extraOpacity;

  // The halo gets tighter (more vignette) with louder signal
  const innerStop = enabled ? Math.max(25, 38 - amplitude * 20) : 38;

  return (
    <div
      aria-hidden="true"
      className="ink-halo pointer-events-none fixed inset-0 z-[1]"
      style={{
        background: `radial-gradient(ellipse 90% 85% at 50% 48%, transparent ${innerStop}%, rgba(8,6,4,${opacity * 0.6}) 65%, rgba(4,3,2,${opacity}) 100%)`,
        transition: 'background 0.15s ease-out',
      }}
    />
  );
}
