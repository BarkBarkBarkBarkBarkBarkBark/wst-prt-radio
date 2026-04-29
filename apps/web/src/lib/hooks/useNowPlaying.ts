'use client';

import { useState, useEffect } from 'react';
import type { NowPlaying } from '@wstprtradio/shared';
import { apiFetch } from '../api';

const POLL_INTERVAL = 12_000;

export function useNowPlaying() {
  const [data, setData] = useState<NowPlaying | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const nowPlaying = await apiFetch<NowPlaying>('/public/now-playing');
        if (!cancelled) {
          setData(nowPlaying);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error('Failed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetch();
    const interval = setInterval(() => void fetch(), POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data, loading, error };
}
