'use client';

import { useState, useRef } from 'react';

interface ChatMessage {
  username: string;
  message: string;
  time: string;
}

const PLACEHOLDER_MESSAGES: ChatMessage[] = [
  { username: 'sailor_dog', message: 'my dog thinks this station is for him.', time: '11:42' },
  { username: 'ramenpuppy', message: 'woof woof woof 🐶', time: '11:43' },
  { username: 'bork_borkington', message: "who let the dogs out? definitely not me.", time: '11:45' },
  { username: 'moonhowler', message: 'awooooooo 🌙', time: '11:47' },
  { username: 'captainbork', message: '10/10 would howl again', time: '11:48' },
];

function Avatar({ username }: { username: string }) {
  return (
    <div className="w-5 h-5 rounded-full bg-accent-red/15 flex items-center justify-center flex-shrink-0">
      <span className="text-[8px] text-accent-red font-bold uppercase">{username[0]}</span>
    </div>
  );
}

export function ChatPanel() {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      id="chat"
      className="flex flex-col border border-stone-200 rounded-2xl overflow-hidden bg-paper"
      style={{ height: '460px' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 flex-shrink-0">
        <p className="text-[10px] tracking-[0.22em] uppercase text-muted">Live Chat</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {PLACEHOLDER_MESSAGES.map((msg) => (
          <div key={msg.username} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Avatar username={msg.username} />
              <span className="text-xs font-medium text-ink">{msg.username}</span>
              <span className="text-[10px] text-muted">{msg.time}</span>
            </div>
            <p className="text-sm text-ink pl-[26px] leading-relaxed">{msg.message}</p>
          </div>
        ))}
      </div>

      {/* Input — Phase 1: decorative mock. Phase 4 will wire up Supabase Realtime. */}
      <div className="px-4 py-3 border-t border-stone-200 flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          placeholder="say something..."
          className="w-full bg-transparent text-sm text-ink placeholder-muted outline-none"
          aria-label="Chat message"
        />
      </div>
    </div>
  );
}
