'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StationModeCard } from '@/components/admin/StationModeCard';
import type { StationMode, NowPlaying } from '@wstprtradio/shared';

interface StationStatusData {
  mode: StationMode;
  nowPlaying: NowPlaying | null;
  azuracastLive: boolean;
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
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">AzuraCast DJ</p>
              <span className={`text-sm font-semibold ${status.azuracastLive ? 'text-green-400' : 'text-gray-400'}`}>
                {status.azuracastLive ? '● Live' : '○ Offline'}
              </span>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cloudflare Stream</p>
              <span className={`text-sm font-semibold ${status.cloudflareConnected ? 'text-green-400' : 'text-gray-400'}`}>
                {status.cloudflareStatus}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
