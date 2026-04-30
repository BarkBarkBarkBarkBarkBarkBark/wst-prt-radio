'use client';

import { useEffect, useState, FormEvent } from 'react';
import { apiFetch } from '@/lib/api';

interface Settings {
  stationName?: string;
  streamPublicUrl?: string;
  streamMetadataProvider?: string;
  legacyAzuracastConfigured?: boolean;
  azuracastBaseUrl?: string;
  azuracastPublicStreamUrl?: string;
  azuracastPublicApiUrl?: string;
  defaultStreamMode?: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<Settings>('/admin/settings').then(setSettings).catch(console.error);
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/admin/settings', { method: 'PATCH', body: JSON.stringify(settings) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof Settings, type = 'text') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
        <input
          type={type}
          value={(settings[key] as string) ?? ''}
          onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>
      <form onSubmit={(e) => void handleSave(e)} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4 max-w-xl">
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-100">
          <p className="font-semibold">Generic stream mode is primary.</p>
          <p className="mt-1 text-amber-200/80">
            Direct playback currently uses <span className="font-mono">{settings.streamPublicUrl ?? 'unconfigured'}</span>.
            AzuraCast fields below are vestigial and only needed if you explicitly revive the old integration.
          </p>
        </div>
        {field('Station Name', 'stationName')}
        <div className="grid gap-2 rounded-lg border border-gray-800 p-4">
          <p className="text-sm font-medium text-gray-300">Legacy AzuraCast (vestigial)</p>
          <p className="text-xs text-gray-500">
            Status: {settings.legacyAzuracastConfigured ? 'configured' : 'not configured'} · Metadata provider: {settings.streamMetadataProvider ?? 'static'}
          </p>
          {field('Legacy AzuraCast Base URL', 'azuracastBaseUrl', 'url')}
          {field('Legacy AzuraCast Public Stream URL', 'azuracastPublicStreamUrl', 'url')}
          {field('Legacy AzuraCast Public API URL', 'azuracastPublicApiUrl', 'url')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Default Mode</label>
          <select
            value={settings.defaultStreamMode ?? 'autodj'}
            onChange={(e) => setSettings((s) => ({ ...s, defaultStreamMode: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="autodj">AutoDJ</option>
            <option value="live_audio">Live Audio</option>
            <option value="live_video">Live Video</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
