'use client';

const STORAGE_KEY = 'wstprtradio-peer-id';

export function getOrCreatePeerId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const next = window.crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, next);
  return next;
}
