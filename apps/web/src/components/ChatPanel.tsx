'use client';

/**
 * ChatPanel — session-local anonymous chat.
 *
 * Messages are stored in sessionStorage (per browser tab, gone on close).
 * Username is a random adjective+animal combo generated once per session.
 * Backend integration: wire in later by replacing the dispatch/load functions.
 *
 * Styled after the West Port Radio inspiration image:
 * — Right-side panel, dark bg, bullet avatar, username, timestamp, message.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  ts: number; // unix ms
}

// ---------------------------------------------------------------------------
// Random username generator
// ---------------------------------------------------------------------------

const ADJS = [
  'radio', 'lunar', 'vinyl', 'neon', 'pixel', 'orbit', 'static', 'signal',
  'analog', 'cosmic', 'drift', 'ghost', 'haze', 'midnight', 'solar',
];
const NOUNS = [
  'dog', 'cat', 'wolf', 'fox', 'crow', 'raven', 'pup', 'bear', 'deer',
  'shark', 'hawk', 'owl', 'bat', 'frog', 'goat',
];

function randomUsername() {
  const adj = ADJS[Math.floor(Math.random() * ADJS.length)]!;
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  return `${adj}_${noun}`;
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const STORAGE_KEY = 'wpr_chat_session_v1';
const USER_KEY    = 'wpr_chat_username_v1';

function loadMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: ChatMessage[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-200)));
  } catch { /* quota */ }
}

// ---------------------------------------------------------------------------
// Seed a few fake messages so it doesn't look empty on first load
// ---------------------------------------------------------------------------

const SEED_MSGS: ChatMessage[] = [
  { id: 's1', user: 'radio_dog',   text: 'this station is for him 🐾',     ts: Date.now() - 8 * 60000 },
  { id: 's2', user: 'lunar_cat',   text: 'woof woof woof 🐺',              ts: Date.now() - 6 * 60000 },
  { id: 's3', user: 'vinyl_owl',   text: 'signal strong tonight',          ts: Date.now() - 4 * 60000 },
  { id: 's4', user: 'orbit_fox',   text: '10/10 would howl again',         ts: Date.now() - 2 * 60000 },
  { id: 's5', user: 'neon_wolf',   text: 'big fan of whatever is playing', ts: Date.now() - 60000 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  className?: string;
  listenerCount?: number;
}

export function ChatPanel({ className = '', listenerCount = 0 }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const stored = loadMessages();
    return stored.length ? stored : SEED_MSGS;
  });
  const [draft, setDraft] = useState('');
  const [username] = useState<string>(() => {
    try {
      return sessionStorage.getItem(USER_KEY) ?? (() => {
        const u = randomUsername();
        sessionStorage.setItem(USER_KEY, u);
        return u;
      })();
    } catch {
      return randomUsername();
    }
  });

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const msg: ChatMessage = { id: uid(), user: username, text, ts: Date.now() };
    setMessages((prev) => {
      const next = [...prev, msg];
      saveMessages(next);
      return next;
    });
    setDraft('');
  }, [draft, username]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); send(); }
  };

  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3 bg-paper/60">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted">Chat</span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-amber-700">
          <span className="inline-block h-1.5 w-1.5 bg-amber-600 accent-flicker" />
          {listenerCount}
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin" style={{ maxHeight: 320 }}>
        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-2.5">
            {/* Avatar marker — hard square */}
            <div className="mt-0.5 h-5 w-5 flex-shrink-0 bg-ink/8 flex items-center justify-center">
              <span className="text-[8px] text-muted font-mono">{m.user[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-mono font-semibold text-ink/70 truncate">{m.user}</span>
                <span className="text-[9px] font-mono text-muted/50 flex-shrink-0">{fmt(m.ts)}</span>
              </div>
              <p className="text-[12px] leading-snug text-ink/60 break-words">{m.text}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-ink/10 flex items-center gap-2 px-3 py-2 bg-paper/40">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="say something…"
          maxLength={200}
          className="flex-1 bg-transparent text-[12px] font-mono text-ink/70 placeholder-muted/40 outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim()}
          className="text-amber-700 disabled:opacity-20 transition-opacity hover:text-accent-red"
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
