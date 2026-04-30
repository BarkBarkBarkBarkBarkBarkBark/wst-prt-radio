'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StationModeCard } from '@/components/admin/StationModeCard';
import type { StationMode, NowPlaying } from '@wstprtradio/shared';

interface StationStatusData {
  mode: StationMode;
  nowPlaying: NowPlaying | null;
  sourceProvider: 'static' | 'azuracast';
  sourceLive: boolean;
  legacyAzuracastConfigured: boolean;
  cloudflareConnected: boolean;
  cloudflareStatus: string;
}

export default function AdminStationPage() {
  const [status, setStatus] = useState<StationStatusData | null>(null);

  useEffect(() => {
    const load = () => apiFetch<StationStatusData>('/admin/station/status').then(setStatus).catch(console.error);
    void load();
    const interval = setInterval(() => void load(), 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Station Status</h1>
      {status && (
        <div className="grid gap-4">
          <StationModeCard mode={status.mode} nowPlaying={status.nowPlaying} />
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Metadata Source</p>
              <span className={`text-sm font-semibold ${status.sourceProvider === 'azuracast' ? 'text-amber-400' : 'text-gray-300'}`}>
                {status.sourceProvider === 'azuracast' ? 'Legacy AzuraCast' : 'Static / Generic Stream'}
              </span>
              <p className="text-xs text-gray-500 mt-2">
                {status.sourceProvider === 'azuracast'
                  ? status.sourceLive
                    ? 'Legacy live-dj detection is active.'
                    : 'Legacy AzuraCast is configured but currently idle.'
                  : 'Now playing is driven by fallback metadata and direct stream playback.'}
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Legacy Services</p>
              <p className="text-sm font-semibold text-gray-300">
                AzuraCast {status.legacyAzuracastConfigured ? 'configured' : 'vestigial'}
              </p>
              <p className="text-xs text-gray-500 mt-2">Cloudflare Stream: <span className={status.cloudflareConnected ? 'text-green-400' : 'text-gray-400'}>{status.cloudflareStatus}</span></p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 col-span-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status Notes</p>
              <span className={`text-sm font-semibold ${status.cloudflareConnected ? 'text-green-400' : 'text-gray-400'}`}>
                Generic Icecast-compatible streaming is now the primary path. AzuraCast remains optional and vestigial.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
