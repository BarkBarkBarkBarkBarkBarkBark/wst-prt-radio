'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StationModeCard } from '@/components/admin/StationModeCard';
import type { StationMode, NowPlaying } from '@wstprtradio/shared';

interface DashboardData {
  mode: StationMode;
  nowPlaying: NowPlaying | null;
  destinationCount: number;
  recentAudit: Array<{ action: string; entity_type: string; entity_id: string; created_at: string }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiFetch<DashboardData>('/admin/dashboard').then(setData).catch(console.error);
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StationModeCard mode={data.mode} nowPlaying={data.nowPlaying} />

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-base font-semibold text-white mb-3">Destinations</h2>
            <p className="text-3xl font-bold text-indigo-400">{data.destinationCount}</p>
            <p className="text-sm text-gray-500 mt-1">active outputs</p>
            <a href="/admin/destinations" className="mt-3 inline-block text-xs text-indigo-400 hover:text-indigo-300">
              Manage →
            </a>
          </div>
        </div>
      )}

      {data?.recentAudit && data.recentAudit.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-base font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-2">
            {data.recentAudit.map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-300 font-mono">{entry.action}</span>
                <span className="text-gray-500 text-xs">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
