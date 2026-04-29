'use client';

import { useEffect, useState, FormEvent } from 'react';
import { apiFetch } from '@/lib/api';

interface Settings {
  stationName?: string;
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
        {field('Station Name', 'stationName')}
        {field('AzuraCast Base URL', 'azuracastBaseUrl', 'url')}
        {field('Public Stream URL', 'azuracastPublicStreamUrl', 'url')}
        {field('Public API URL', 'azuracastPublicApiUrl', 'url')}
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
