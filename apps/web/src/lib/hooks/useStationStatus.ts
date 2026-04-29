'use client';

import { useState, useEffect } from 'react';
import type { StationStatus } from '@wstprtradio/shared';
import { apiFetch } from '../api';

const POLL_INTERVAL = 15_000;

export function useStationStatus() {
  const [data, setData] = useState<StationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const status = await apiFetch<StationStatus>('/public/status');
        if (!cancelled) {
          setData(status);
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
