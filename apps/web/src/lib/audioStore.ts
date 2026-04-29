'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// Derive the stream URL from env vars. NEXT_PUBLIC_STREAM_URL takes precedence;
// otherwise fall back to building from NEXT_PUBLIC_API_BASE_URL (legacy), then
// the production default.
const STREAM_URL =
  process.env.NEXT_PUBLIC_STREAM_URL ??
  (process.env.NEXT_PUBLIC_API_BASE_URL
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL.replace('/api', '')}/radio.mp3`
    : 'https://radio.wstprtradio.com/radio.mp3');

/**
 * Manages a single HTMLAudioElement for the radio stream.
 * Safe to call from any client component rendered on the homepage.
 */
export function useAudioStore() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAudio = useCallback((): HTMLAudioElement | null => {
    if (typeof window === 'undefined') return null;
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return audioRef.current;
  }, []);

  // Tear down on unmount
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = getAudio();
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      audio.src = '';
      setIsPlaying(false);
    } else {
      audio.src = STREAM_URL;
      audio.muted = isMuted;
      void audio.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [isPlaying, isMuted, getAudio]);

  const toggleMute = useCallback(() => {
    const audio = getAudio();
    if (audio) {
      audio.muted = !isMuted;
    }
    setIsMuted((m) => !m);
  }, [isMuted, getAudio]);

  return { isPlaying, isMuted, togglePlay, toggleMute };
}
