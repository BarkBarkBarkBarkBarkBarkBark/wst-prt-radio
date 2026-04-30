'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export function WebDjButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function openWebDj() {
    setLoading(true);
    setError('');
    try {
      const { url } = await apiFetch<{ url: string }>('/admin/live/audio/open-web-dj-link', {
        method: 'POST',
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get Web DJ link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Legacy Web DJ (AzuraCast)</h2>
        <p className="text-sm text-gray-500 mt-1">
          This button only works if the old AzuraCast integration is still configured. The primary
          path now is a generic Icecast-compatible source such as BUTT, Mixxx, OBS, or Liquidsoap.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={() => void openWebDj()}
        disabled={loading}
        className="bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
      >
        {loading ? 'Opening…' : '🎙 Open Legacy Web DJ'}
      </button>
    </div>
  );
}
