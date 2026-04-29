'use client';

interface AudioControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  chatOpen: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onToggleChat: () => void;
}

function PlayIcon() {
  return (
    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function SoundIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

interface CircleButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  large?: boolean;
  active?: boolean;
}

function CircleButton({ onClick, children, label, large, active }: CircleButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={[
        'rounded-full border border-ink flex items-center justify-center transition-colors',
        'hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red',
        large ? 'w-14 h-14' : 'w-10 h-10',
        active ? 'bg-ink text-paper' : 'text-ink bg-transparent',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function AudioControls({
  isPlaying,
  isMuted,
  chatOpen,
  onTogglePlay,
  onToggleMute,
  onToggleChat,
}: AudioControlsProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Mute / Unmute */}
      <CircleButton onClick={onToggleMute} label={isMuted ? 'Unmute' : 'Mute'} active={isMuted}>
        {isMuted ? <MuteIcon /> : <SoundIcon />}
      </CircleButton>

      {/* Play / Pause — larger */}
      <CircleButton
        onClick={onTogglePlay}
        label={isPlaying ? 'Pause' : 'Play'}
        large
        active={isPlaying}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </CircleButton>

      {/* Chat toggle — with red notification dot */}
      <div className="relative">
        <CircleButton onClick={onToggleChat} label="Toggle chat" active={chatOpen}>
          <ChatIcon />
        </CircleButton>
        <span
          className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-accent-red pointer-events-none"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
