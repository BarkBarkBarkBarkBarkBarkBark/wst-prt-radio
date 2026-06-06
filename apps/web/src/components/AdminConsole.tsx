'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminStatus, SignalServerMessage, StationStatus } from '@wstprtradio/shared';
import { apiFetch, ApiError, getSignalUrl, API_BASE } from '@/lib/api';
import { StatusBadge } from './StatusBadge';

type Tab = 'radio' | 'songs' | 'events';

interface Song { id: string; title: string; filename: string; url: string; mimeType: string }
interface Event {
  id: string; title: string; description: string | null; event_date: string;
  venue: string | null; ticket_url: string | null; image_url: string | null; is_published: number;
}

// ─── Songs Tab ───────────────────────────────────────────────────────────────

function SongsTab() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSongs = useCallback(async () => {
    try {
      const d = await apiFetch<{ songs: Song[] }>('/admin/songs');
      setSongs(d.songs);
    } catch { setMsg('Failed to load songs.'); }
  }, []);

  useEffect(() => { void loadSongs(); }, [loadSongs]);

  const upload = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setMsg('Pick a file first.'); return; }
    setUploading(true);
    setMsg('Uploading…');
    const form = new FormData();
    form.append('file', file);
    try {
      const d = await apiFetch<{ ok: boolean; songs: Song[] }>('/admin/songs/upload', { method: 'POST', body: form });
      setSongs(d.songs);
      setMsg(`✓ Uploaded "${file.name}"`);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Upload failed.');
    } finally { setUploading(false); }
  }, []);

  const deleteSong = useCallback(async (filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      const d = await apiFetch<{ ok: boolean; songs: Song[] }>(`/admin/songs/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      setSongs(d.songs);
      setMsg(`✓ Deleted "${filename}"`);
    } catch { setMsg('Delete failed.'); }
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-ink">Upload Song</h3>
        <p className="text-xs text-muted">Supported: MP3, WAV, OGG, FLAC, M4A · Max 100 MB</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".mp3,.wav,.ogg,.flac,.m4a,.oga"
            className="text-sm text-muted file:mr-3 file:border file:border-ink file:bg-paper file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-widest file:font-semibold cursor-pointer"
          />
          <button
            type="button"
            onClick={() => void upload()}
            disabled={uploading}
            className="border border-ink bg-ink px-5 py-2 text-xs font-bold uppercase tracking-[0.25em] text-paper hover:border-accent-red hover:bg-accent-red disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {msg && <p className="text-xs text-muted">{msg}</p>}
      </div>

      <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 space-y-3">
        <h3 className="text-lg font-semibold text-ink">Playlist ({songs.length} tracks)</h3>
        {songs.length === 0 ? (
          <p className="text-sm text-muted">No songs yet. Upload some above to start the jukebox.</p>
        ) : (
          <ul className="space-y-2">
            {songs.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-paper px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{s.title}</p>
                  <p className="text-xs text-muted truncate">{s.filename}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={`${API_BASE}${s.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs uppercase tracking-widest text-muted hover:text-ink"
                  >
                    Play
                  </a>
                  <button
                    type="button"
                    onClick={() => void deleteSong(s.filename)}
                    className="text-xs uppercase tracking-widest text-muted hover:text-accent-red"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Events Tab ──────────────────────────────────────────────────────────────

function EventsTab() {
  const [events, setEvents] = useState<Event[]>([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ title: '', event_date: '', venue: '', description: '', ticket_url: '', image_url: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const d = await apiFetch<{ events: Event[] }>('/admin/events');
      setEvents(d.events);
    } catch { setMsg('Failed to load events.'); }
  }, []);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const createEvent = useCallback(async () => {
    if (!form.title || !form.event_date) { setMsg('Title and date are required.'); return; }
    setSubmitting(true);
    try {
      const d = await apiFetch<{ ok: boolean; event: Event }>('/admin/events', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setEvents((prev) => [...prev, d.event].sort((a, b) => a.event_date.localeCompare(b.event_date)));
      setForm({ title: '', event_date: '', venue: '', description: '', ticket_url: '', image_url: '' });
      setMsg('✓ Event created.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to create event.'); }
    finally { setSubmitting(false); }
  }, [form]);

  const deleteEvent = useCallback(async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await apiFetch(`/admin/events/${id}`, { method: 'DELETE' });
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setMsg('✓ Event deleted.');
    } catch { setMsg('Delete failed.'); }
  }, []);

  const togglePublish = useCallback(async (ev: Event) => {
    try {
      const d = await apiFetch<{ ok: boolean; event: Event }>(`/admin/events/${ev.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_published: ev.is_published === 0 }),
      });
      setEvents((prev) => prev.map((e) => e.id === d.event.id ? d.event : e));
    } catch { setMsg('Update failed.'); }
  }, []);

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-ink">Create Event</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { key: 'title', label: 'Title *', type: 'text', placeholder: 'Show name' },
            { key: 'event_date', label: 'Date & Time *', type: 'datetime-local', placeholder: '' },
            { key: 'venue', label: 'Venue', type: 'text', placeholder: 'Venue name' },
            { key: 'ticket_url', label: 'Ticket URL', type: 'url', placeholder: 'https://…' },
            { key: 'image_url', label: 'Image URL', type: 'url', placeholder: 'https://…' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key} className="space-y-1">
              <label className="text-[0.6rem] uppercase tracking-[0.3em] text-muted font-mono">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border border-stone-300 bg-paper px-3 py-2 text-sm text-ink placeholder-stone-400 focus:border-ink focus:outline-none"
              />
            </div>
          ))}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[0.6rem] uppercase tracking-[0.3em] text-muted font-mono">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Event description…"
              className="w-full border border-stone-300 bg-paper px-3 py-2 text-sm text-ink placeholder-stone-400 focus:border-ink focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void createEvent()}
            disabled={submitting}
            className="border border-ink bg-ink px-5 py-2 text-xs font-bold uppercase tracking-[0.25em] text-paper hover:border-accent-red hover:bg-accent-red disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving…' : 'Create Event'}
          </button>
          {msg && <p className="text-xs text-muted">{msg}</p>}
        </div>
      </div>

      {/* Events list */}
      <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 space-y-3">
        <h3 className="text-lg font-semibold text-ink">Events ({events.length})</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted">No events yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li key={ev.id} className="rounded-2xl border border-stone-200 bg-paper px-4 py-3 space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink text-sm truncate">{ev.title}</p>
                    <p className="text-xs text-muted">
                      {new Date(ev.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      {ev.venue ? ` · ${ev.venue}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-xs uppercase tracking-widest">
                    <button
                      type="button"
                      onClick={() => void togglePublish(ev)}
                      className={`px-2 py-1 border text-[10px] ${ev.is_published ? 'border-emerald-400 text-emerald-700' : 'border-stone-300 text-muted'}`}
                    >
                      {ev.is_published ? 'Published' : 'Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteEvent(ev.id, ev.title)}
                      className="text-muted hover:text-accent-red"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Main AdminConsole ────────────────────────────────────────────────────────

export function AdminConsole() {
  const router = useRouter();
  const [me, setMe] = useState<{ username: string } | null>(null);
  const [authError, setAuthError] = useState(false);
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [message, setMessage] = useState('Loading admin console…');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [tab, setTab] = useState<Tab>('radio');

  const loadStatus = useCallback(async (): Promise<boolean> => {
    try {
      const next = await apiFetch<AdminStatus>('/admin/status');
      setStatus(next);
      setMessage('Admin console connected.');
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { router.replace('/admin/login'); return false; }
      setMessage('Unable to reach the admin API.');
      return false;
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ username: string }>('/auth/me')
      .then((u) => { if (cancelled) return; setMe(u); void loadStatus(); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) { router.replace('/admin/login'); }
        else { setAuthError(true); setMessage('Cannot reach the API. Check NEXT_PUBLIC_API_BASE_URL.'); }
      });
    return () => { cancelled = true; };
  }, [loadStatus, router]);

  useEffect(() => {
    if (!me) return undefined;
    let ws: WebSocket | null = null;
    let pollTimer: number | null = null;
    const startPolling = () => { if (pollTimer !== null) return; pollTimer = window.setInterval(() => { void loadStatus(); }, 5_000); };
    const stopPolling = () => { if (pollTimer !== null) { window.clearInterval(pollTimer); pollTimer = null; } };
    const connect = () => {
      ws = new WebSocket(getSignalUrl());
      ws.onopen = () => { setWsConnected(true); stopPolling(); };
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as SignalServerMessage;
          if (payload.type === 'station_status') {
            setStatus((prev) => (prev ? { ...prev, ...(payload as StationStatus) } : prev));
            void loadStatus();
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { setWsConnected(false); startPolling(); window.setTimeout(connect, 3_000); };
    };
    connect();
    return () => { stopPolling(); ws?.close(); };
  }, [loadStatus, me]);

  const runAction = useCallback(async (path: string, label: string) => {
    setLoadingAction(label);
    try {
      await apiFetch<{ ok: boolean; status: AdminStatus }>(path, { method: 'POST' });
      await loadStatus();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { router.replace('/admin/login'); return; }
      setMessage(error instanceof Error ? error.message : 'Action failed.');
    } finally { setLoadingAction(null); }
  }, [loadStatus, router]);

  const logout = useCallback(async () => {
    try { await apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    router.replace('/admin/login');
  }, [router]);

  const streamLink = useMemo(() => typeof window === 'undefined' ? '' : `${window.location.origin}/stream`, []);

  if (!me) {
    return (
      <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 text-sm text-muted">
        {authError ? (
          <p className="text-accent-red">⚠ Cannot reach the API. Make sure <code>NEXT_PUBLIC_API_BASE_URL</code> is set.</p>
        ) : ('Verifying session…')}
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'radio', label: 'Radio Control' },
    { key: 'songs', label: 'Songs' },
    { key: 'events', label: 'Events' },
  ];

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <StatusBadge state={status?.stationState ?? 'open'} />
            <h2 className="text-3xl font-semibold text-ink">Admin</h2>
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted">
            <span className="rounded-full border border-stone-300 px-3 py-1.5 text-ink">{me.username}</span>
            <span className={wsConnected ? 'text-emerald-600' : 'text-amber-600'}>{wsConnected ? 'live' : 'polling'}</span>
            <button type="button" onClick={() => void logout()}
              className="rounded-full border border-stone-300 px-3 py-1.5 text-ink transition hover:border-accent-red hover:text-accent-red">
              Logout
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-5 flex gap-1 border-b border-stone-200">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] border-b-2 -mb-px transition-colors ${
                tab === key ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Radio Control tab */}
      {tab === 'radio' && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Open Stream', path: '/admin/open' },
                { label: 'Close Stream', path: '/admin/close' },
                { label: 'Kick Streamer', path: '/admin/kick' },
                { label: 'Block Streamer', path: '/admin/block' },
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
                onClick={() => { void navigator.clipboard.writeText(streamLink); setMessage('Stream link copied.'); }}
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
              <div><dt className="text-xs uppercase tracking-[0.24em]">Broadcaster</dt>
                <dd className="mt-1 text-ink">{status?.currentBroadcaster?.displayName ?? status?.currentBroadcaster?.peerId ?? 'Nobody live'}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.24em]">Listeners</dt>
                <dd className="mt-1 text-ink">{status?.listenerCount ?? 0}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.24em]">Blocklist</dt>
                <dd className="mt-1 text-ink">{status?.blockedPeerCount ?? 0} blocked peer(s)</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.24em]">Live session</dt>
                <dd className="mt-1 break-all text-ink">{status?.liveSessionId ?? 'Idle'}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {tab === 'songs' && <SongsTab />}
      {tab === 'events' && <EventsTab />}
    </div>
  );
}
