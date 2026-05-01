'use client';

/**
 * Distinct peer IDs per role within the same browser.
 *
 * The signaling server keys the live-broadcaster slot and listener
 * connections by peerId, with one connection allowed per peerId. If the
 * AudioProvider (listener) and the StreamClient (broadcaster) shared a single
 * id, opening /stream after pressing Play would make the two WebSocket
 * connections evict each other in a loop. Keeping them on separate ids lets a
 * single browser broadcast and listen at the same time without the server
 * thinking they're the same connection being replaced.
 */

export type PeerRole = 'listener' | 'broadcaster';

const STORAGE_KEYS: Record<PeerRole, string> = {
  listener: 'wstprtradio-listener-peer-id',
  broadcaster: 'wstprtradio-broadcaster-peer-id',
};

export function getOrCreatePeerId(role: PeerRole = 'listener'): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const key = STORAGE_KEYS[role];
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const next = window.crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}
