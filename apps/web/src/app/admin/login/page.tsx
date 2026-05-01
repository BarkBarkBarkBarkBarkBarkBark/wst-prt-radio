'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PublicShell } from '@/components/PublicShell';
import { apiFetch, ApiError } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already signed in, hop straight to /admin.
  useEffect(() => {
    void apiFetch<{ username: string }>('/auth/me')
      .then(() => router.replace('/admin'))
      .catch(() => undefined);
  }, [router]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      try {
        await apiFetch<{ ok: boolean; username: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });
        router.replace('/admin');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setError('Invalid username or password.');
        } else if (err instanceof ApiError && err.status === 429) {
          setError('Too many attempts. Wait a minute and try again.');
        } else {
          setError(err instanceof Error ? err.message : 'Login failed.');
        }
      } finally {
        setLoading(false);
      }
    },
    [password, router, username],
  );

  return (
    <PublicShell>
      <div className="mx-auto max-w-md space-y-6">
        <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Admin sign-in</h2>
          <p className="mt-2 text-sm text-muted">
            Sign in to kick / block / open / close the live broadcaster.
          </p>

          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
            <label className="block text-sm text-muted">
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-ink outline-none focus:border-accent-red"
              />
            </label>

            <label className="block text-sm text-muted">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-ink outline-none focus:border-accent-red"
              />
            </label>

            {error && <p className="text-sm text-accent-red">{error}</p>}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full rounded-full border border-ink bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:border-accent-red hover:bg-accent-red disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </PublicShell>
  );
}
