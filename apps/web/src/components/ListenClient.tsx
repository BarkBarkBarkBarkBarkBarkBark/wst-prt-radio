'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlwaysOnPlaylist, SignalServerMessage, StationStatus } from '@wstprtradio/shared';
import { API_BASE, getSignalUrl, apiFetch } from '@/lib/api';
import { getOrCreatePeerId } from '@/lib/peerId';
import { AudioVisualizer } from './AudioVisualizer';
import { VolumeKnob } from './VolumeKnob';
import { ChatPanel } from './ChatPanel';
import { StatusBadge } from './StatusBadge';

interface ListenClientProps {
  autoStart?: boolean;
  compact?: boolean;
  title?: string;
  subtitle?: string;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function serializeCandidate(candidate: RTCIceCandidate) {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment ?? null,
  };
}

export function ListenClient({
  autoStart = false,
  compact = false,
  title = 'Listener',
  subtitle = 'Open the page, tap listen, and stay attached to the live broadcaster. The player auto-recovers when the stream drops.',
}: ListenClientProps) {
  const [status, setStatus] = useState<StationStatus | null>(null);
  const [playlist, setPlaylist] = useState<AlwaysOnPlaylist | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('Tap listen to connect to the station.');
  const [peerId, setPeerId] = useState('');
  const [connected, setConnected] = useState(false);
  const [currentFallbackIndex, setCurrentFallbackIndex] = useState(0);
  const [volume, setVolume] = useState(75); // 0–100; 0 = paused

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const targetBroadcasterRef = useRef<string | null>(null);
  const enabledRef = useRef(false);
  const fallbackModeRef = useRef(false);

  useEffect(() => {
    setPeerId(getOrCreatePeerId());
    void Promise.all([
      apiFetch<StationStatus>('/public/status').then(setStatus),
      apiFetch<AlwaysOnPlaylist>('/public/autoplay').then(setPlaylist),
    ]).catch(() => {
      setMessage('Unable to reach the control server right now.');
    });
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (autoStart) {
      setEnabled(true);
    }
  }, [autoStart]);

  const closePeer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    targetBroadcasterRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  }, []);

  const stopFallbackAudio = useCallback(() => {
    fallbackModeRef.current = false;
    if (!audioRef.current) {
      return;
    }
    audioRef.current.pause();
    audioRef.current.removeAttribute('src');
    audioRef.current.load();
  }, []);

  const playFallbackTrack = useCallback(
    async (index: number) => {
      if (!audioRef.current || !playlist?.tracks.length || !enabledRef.current) {
        return;
      }

      const normalizedIndex = index % playlist.tracks.length;
      const track = playlist.tracks[normalizedIndex];
      if (!track) {
        return;
      }
      fallbackModeRef.current = true;
      audioRef.current.srcObject = null;
      audioRef.current.src = `${API_BASE}${track.url}`;
      audioRef.current.load();

      try {
        await audioRef.current.play();
        setCurrentFallbackIndex(normalizedIndex);
        setMessage(`Always-on: ${track.title}`);
      } catch {
        setMessage(`Ready: ${track.title}. Tap once if your browser blocks autoplay.`);
      }
    },
    [playlist],
  );

  const ensureFallbackAudio = useCallback(async () => {
    if (!playlist?.tracks.length) {
      setMessage('No always-on tracks are available yet.');
      return;
    }
    await playFallbackTrack(currentFallbackIndex);
  }, [currentFallbackIndex, playFallbackTrack, playlist]);

  const scheduleReconnect = useCallback(() => {
    if (!enabledRef.current || reconnectTimerRef.current !== null) {
      return;
    }

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      connect();
    }, 2_000);
  }, []);

  const sendJson = useCallback((payload: unknown) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    wsRef.current.send(JSON.stringify(payload));
  }, []);

  const startPeerConnection = useCallback(
    async (broadcasterPeerId: string) => {
      if (!peerId || !enabledRef.current) {
        return;
      }

      closePeer();
      setMessage('Connecting to the live stream…');

      const peer = new RTCPeerConnection(rtcConfig);
      peerRef.current = peer;
      targetBroadcasterRef.current = broadcasterPeerId;

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (audioRef.current) {
          stopFallbackAudio();
          audioRef.current.srcObject = stream ?? new MediaStream([event.track]);
          void audioRef.current.play().catch(() => {
            setMessage('Connected. If you cannot hear audio, tap listen again.');
          });
        }
        setMessage('You are listening live.');
      };

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        sendJson({
          type: 'ice_candidate',
          peerId,
          targetPeerId: broadcasterPeerId,
          candidate: serializeCandidate(event.candidate),
        });
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
          setMessage('Connection dropped. Reconnecting…');
          closePeer();
        }
      };

      peer.addTransceiver('audio', { direction: 'recvonly' });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendJson({ type: 'sdp_offer', peerId, targetPeerId: broadcasterPeerId, sdp: offer.sdp ?? '' });
    },
    [closePeer, peerId, sendJson, stopFallbackAudio],
  );

  const handleServerMessage = useCallback(
    async (payload: SignalServerMessage) => {
      if (payload.type === 'listener_accepted') {
        setConnected(true);
        setMessage('Connected. Waiting for a broadcaster…');
        return;
      }

      if (payload.type === 'station_status') {
        setStatus(payload);

        if (!payload.broadcasterPresent || !payload.broadcasterPeerId) {
          closePeer();
          await ensureFallbackAudio();
          return;
        }

        if (targetBroadcasterRef.current !== payload.broadcasterPeerId) {
          await startPeerConnection(payload.broadcasterPeerId);
        }
        return;
      }

      if (payload.type === 'peer_answer' && peerRef.current) {
        await peerRef.current.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
        return;
      }

      if (payload.type === 'ice_candidate' && peerRef.current) {
        await peerRef.current.addIceCandidate(payload.candidate);
        return;
      }

      if (payload.type === 'force_disconnect') {
        setMessage(payload.reason);
        closePeer();
      }
    },
    [closePeer, ensureFallbackAudio, startPeerConnection],
  );

  const connect = useCallback(() => {
    if (!enabledRef.current || !peerId) {
      return;
    }

    wsRef.current?.close();

    const ws = new WebSocket(getSignalUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setMessage('Joining the listener room…');
      sendJson({ type: 'join_as_listener', peerId });
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as SignalServerMessage;
        void handleServerMessage(payload);
      } catch {
        setMessage('Received an invalid server message.');
      }
    };

    ws.onclose = () => {
      setConnected(false);
      closePeer();
      scheduleReconnect();
    };

    ws.onerror = () => {
      setMessage('Signal link failed. Retrying…');
    };
  }, [closePeer, handleServerMessage, peerId, scheduleReconnect, sendJson]);

  useEffect(() => {
    if (!enabled || !peerId) {
      return;
    }

    connect();

    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      sendJson({ type: 'leave', peerId });
      wsRef.current?.close();
      closePeer();
      stopFallbackAudio();
    };
  }, [closePeer, connect, enabled, peerId, sendJson, stopFallbackAudio]);

  useEffect(() => {
    if (!enabled || !playlist?.tracks.length || status?.broadcasterPresent) {
      return;
    }

    void ensureFallbackAudio();
  }, [enabled, ensureFallbackAudio, playlist, status?.broadcasterPresent]);

  const handleTrackEnded = useCallback(() => {
    if (!fallbackModeRef.current || !playlist?.tracks.length) {
      return;
    }
    const nextIndex = (currentFallbackIndex + 1) % playlist.tracks.length;
    void playFallbackTrack(nextIndex);
  }, [currentFallbackIndex, playFallbackTrack, playlist]);

  // Volume knob: 0 = pause, >0 = set volume and ensure playing
  const handleVolumeChange = useCallback((val: number) => {
    setVolume(val);
    const audio = audioRef.current;
    if (!audio) return;
    if (val === 0) {
      audio.pause();
    } else {
      audio.volume = val / 100;
      if (audio.paused && (audio.src || audio.srcObject)) {
        void audio.play().catch(() => {});
      }
      if (!enabled) setEnabled(true);
    }
  }, [audioRef, enabled]);

  // Sync audio volume whenever it changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
  }, [audioRef, volume]);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <StatusBadge state={status?.stationState ?? 'open'} />
            <h2 className={`${compact ? 'text-xl' : 'text-2xl'} font-semibold text-ink`}>{title}</h2>
            {!compact && (
              <p className="max-w-2xl text-sm leading-6 text-muted">{subtitle}</p>
            )}
          </div>
          {!enabled && (
            <button
              type="button"
              onClick={() => { setEnabled(true); setVolume(75); }}
              className="rounded-full border border-ink bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:border-accent-red hover:bg-accent-red"
            >
              {autoStart ? 'Wake Audio' : 'Listen'}
            </button>
          )}
        </div>
      </div>

      {/* Main grid: visualizer+controls | chat */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        {/* Left: player controls + visualizer */}
        <div className="rounded-[2rem] border border-stone-300/70 bg-[#0e0e0e] p-5 space-y-4">
          {/* Hidden audio element */}
          <audio ref={audioRef} className="hidden" onEnded={() => void handleTrackEnded()} />

          {/* Visualizer */}
          <AudioVisualizer audioRef={audioRef} />

          {/* Controls row: volume knob + status */}
          <div className="flex items-end gap-6">
            <VolumeKnob value={volume} onChange={handleVolumeChange} size={72} label="VOL" />
            <div className="flex-1 space-y-1.5 font-mono text-[11px] text-white/35 leading-relaxed">
              <p className="text-white/55">{message}</p>
              <p>
                {status?.broadcasterPresent ? '● live broadcast' : '○ always-on'}{' '}
                · {status?.listenerCount ?? 0} listening
              </p>
              <p>{connected ? '▲ signal ok' : '▽ signal idle'}</p>
              <p>{playlist?.tracks.length ? `${playlist.tracks.length} tracks loaded` : 'loading tracks…'}</p>
            </div>
          </div>
        </div>

        {/* Right: chat panel */}
        <ChatPanel
          className="min-h-[300px]"
          listenerCount={status?.listenerCount ?? 0}
        />
      </div>
    </div>
  );
}
