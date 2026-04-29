'use client';

import { useState } from 'react';
import type { Destination } from '@wstprtradio/shared';
import { apiFetch } from '@/lib/api';

interface DestinationsTableProps {
  destinations: Destination[];
  onRefresh: () => void;
}

const kindLabels: Record<string, string> = {
  twitch: 'Twitch',
  instagram: 'Instagram',
  custom_rtmp: 'Custom RTMP',
  custom_srt: 'Custom SRT',
  tiktok_experimental: 'TikTok (exp)',
  discord_notify: 'Discord Notify',
};

export function DestinationsTable({ destinations, onRefresh }: DestinationsTableProps) {
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  async function handleDelete(id: string) {
    if (!confirm('Delete this destination?')) return;
    await apiFetch(`/admin/destinations/${id}`, { method: 'DELETE' });
    onRefresh();
  }

  async function handleTest(id: string) {
    setTesting(id);
    try {
      const { ok } = await apiFetch<{ ok: boolean }>(`/admin/destinations/${id}/test`, { method: 'POST' });
      setTestResults((r) => ({ ...r, [id]: ok }));
    } finally {
      setTesting(null);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    await apiFetch(`/admin/destinations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !enabled }),
    });
    onRefresh();
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {destinations.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No destinations configured</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Kind</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {destinations.map((d) => (
              <tr key={d.id} className="border-b border-gray-800/50 last:border-0">
                <td className="px-4 py-3 text-white font-medium">{d.name}</td>
                <td className="px-4 py-3 text-gray-400">{kindLabels[d.kind] ?? d.kind}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => void handleToggle(d.id, d.enabled)}
                    className={`text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                      d.enabled
                        ? 'bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:text-red-400'
                        : 'bg-gray-800 text-gray-500 hover:bg-green-500/10 hover:text-green-400'
                    }`}
                  >
                    {d.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  {testResults[d.id] !== undefined && (
                    <span className={`ml-2 text-xs ${testResults[d.id] ? 'text-green-400' : 'text-red-400'}`}>
                      {testResults[d.id] ? '✓ OK' : '✗ Fail'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => void handleTest(d.id)}
                    disabled={testing === d.id}
                    className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                  >
                    {testing === d.id ? 'Testing…' : 'Test'}
                  </button>
                  <button
                    onClick={() => void handleDelete(d.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
