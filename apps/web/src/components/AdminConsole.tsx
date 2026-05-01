'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminStatus } from '@wstprtradio/shared';
import { apiFetch } from '@/lib/api';
import { StatusBadge } from './StatusBadge';

export function AdminConsole() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [message, setMessage] = useState('Admin controls are open in local-first mode.');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const next = await apiFetch<AdminStatus>('/admin/status');
      setStatus(next);
      setMessage('Admin console connected.');
    } catch {
      setMessage('Unable to reach the admin API.');
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const interval = window.setInterval(() => {
      void loadStatus();
    }, 5_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadStatus]);

  const runAction = useCallback(
    async (path: string, label: string) => {
      setLoadingAction(label);
      try {
        await apiFetch<{ ok: boolean; status: AdminStatus }>(path, { method: 'POST' });
        await loadStatus();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Action failed.');
      } finally {
        setLoadingAction(null);
      }
    },
    [loadStatus],
  );

  const streamLink = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return `${window.location.origin}/stream`;
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <StatusBadge state={status?.stationState ?? 'open'} />
            <h2 className="text-3xl font-semibold text-ink">Admin</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Open, close, kick, block, and monitor the one-broadcaster WebRTC station from a single screen.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Open Stream', path: '/admin/open' },
              { label: 'Close Stream', path: '/admin/close' },
              { label: 'Kick Current Streamer', path: '/admin/kick' },
              { label: 'Block Current Streamer', path: '/admin/block' },
              { label: 'Clear Blocklist', path: '/admin/clear-blocks' },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => void runAction(action.path, action.label)}
                disabled={loadingAction !== null}
                className="rounded-[1.5rem] border border-ink bg-ink px-5 py-4 text-left text-sm font-semibold text-paper transition hover:border-accent-red hover:bg-accent-red disabled:opacity-50"
              >
                {loadingAction === action.label ? 'Working…' : action.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(streamLink);
                setMessage('Stream link copied.');
              }}
              className="rounded-[1.5rem] border border-stone-300 bg-paper px-5 py-4 text-left text-sm font-semibold text-ink transition hover:border-accent-red hover:text-accent-red"
            >
              Copy Stream Link
            </button>
          </div>

          <div className="rounded-[2rem] border border-stone-300/70 bg-paper/90 p-6 text-sm text-muted">
            <p>{message}</p>
          </div>

          <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6">
            <h3 className="text-lg font-semibold text-ink">Recent activity</h3>
            <div className="mt-4 space-y-3">
              {status?.recentAudit.length ? (
                status.recentAudit.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-stone-200 bg-paper px-4 py-3 text-sm text-muted">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-ink">{entry.action}</span>
                      <span className="text-xs uppercase tracking-[0.2em]">{new Date(entry.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="mt-1 text-xs">{entry.actor}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No audit entries yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 text-sm text-muted">
          <h3 className="text-lg font-semibold text-ink">Station snapshot</h3>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.24em]">Broadcaster</dt>
              <dd className="mt-1 text-ink">{status?.currentBroadcaster?.displayName ?? status?.currentBroadcaster?.peerId ?? 'Nobody live'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em]">Listeners</dt>
              <dd className="mt-1 text-ink">{status?.listenerCount ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em]">Blocklist</dt>
              <dd className="mt-1 text-ink">{status?.blockedPeerCount ?? 0} blocked peer(s)</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em]">Live session</dt>
              <dd className="mt-1 break-all text-ink">{status?.liveSessionId ?? 'Idle'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
