'use client';

import { useState, useEffect } from 'react';
import type { LiveSession } from '@wstprtradio/shared';
import { apiFetch } from '../api';

const POLL_INTERVAL = 10_000;

export function useLiveSession() {
  const [data, setData] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const session = await apiFetch<LiveSession | null>('/public/live-session');
        if (!cancelled) {
          setData(session);
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
