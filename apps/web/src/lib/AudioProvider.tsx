'use client';

/**
 * AudioProvider — global audio context for West Port Radio.
 *
 * All WebRTC / WebSocket / fallback-audio logic lives here so it survives
 * page navigation and feeds the persistent PlayerBar and vinyl glow.
 *
 * Always-on sync:
 *   The server maintains a scheduler (trackIndex + startedAt timestamp).
 *   Each station_status WS message includes alwaysOnState.  When we load a
 *   track we seek to (Date.now() - startedAt) / 1000 seconds so every listener
 *   hears the same moment in the same track — real radio behaviour.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AlwaysOnPlaylist, SignalServerMessage, StationStatus } from '@wstprtradio/shared';
import { API_BASE, getSignalUrl, apiFetch } from '@/lib/api';
import { getOrCreatePeerId } from '@/lib/peerId';

// ─── Public interface ────────────────────────────────────────────────────────

export interface AudioContextValue {
  enabled: boolean;
  connected: boolean;
  message: string;
  status: StationStatus | null;
  playlist: AlwaysOnPlaylist | null;
  volume: number;
  currentFallbackIndex: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  amplitude: number;
  setEnabled: (v: boolean) => void;
  handleVolumeChange: (v: number) => void;
  handleTrackEnded: () => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be used inside <AudioProvider>');
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

function serializeCandidate(c: RTCIceCandidate) {
  return {
    candidate: c.candidate,
    sdpMid: c.sdpMid,
    sdpMLineIndex: c.sdpMLineIndex,
    usernameFragment: c.usernameFragment ?? null,
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus]             = useState<StationStatus | null>(null);
  const [playlist, setPlaylist]         = useState<AlwaysOnPlaylist | null>(null);
  const [enabled, setEnabledRaw]        = useState(false);
  const [message, setMessage]           = useState('Tap play to tune in.');
  const [peerId, setPeerId]             = useState('');
  const [connected, setConnected]       = useState(false);
  const [currentFallbackIndex, setCurrentFallbackIndex] = useState(0);
  const [volume, setVolumeState]        = useState(75);
  const [amplitude, setAmplitude]       = useState(0);

  const wsRef             = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const peerRetryTimerRef = useRef<number | null>(null);
  const audioRef          = useRef<HTMLAudioElement | null>(null);
  const peerRef           = useRef<RTCPeerConnection | null>(null);
  const targetBroadRef    = useRef<string | null>(null);
  const enabledRef        = useRef(false);
  const fallbackModeRef   = useRef(false);
  // ICE candidates that arrive before setRemoteDescription resolves are
  // illegal to add and are silently dropped without buffering — that's the
  // most common cause of "WebRTC handshake completes but no audio" failures.
  const pendingIceRef     = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef  = useRef(false);

  // Web Audio for amplitude polling
  const webAudioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const ampRafRef       = useRef<number | null>(null);

  // ── Web Audio setup ───────────────────────────────────────────────────────

  const ensureWebAudio = useCallback(() => {
    if (webAudioCtxRef.current || !audioRef.current) return;
    try {
      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize               = 256;
      analyser.smoothingTimeConstant = 0.82;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      webAudioCtxRef.current = ctx;
      analyserRef.current    = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const poll = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += Math.abs(v - 128);
        setAmplitude(Math.min(1, (sum / data.length / 128) * 4));
        ampRafRef.current = requestAnimationFrame(poll);
      };
      ampRafRef.current = requestAnimationFrame(poll);
    } catch {
      // AudioContext unavailable
    }
  }, []);

  // ── setEnabled (public) ───────────────────────────────────────────────────

  const setEnabled = useCallback(
    (v: boolean) => {
      setEnabledRaw(v);
      if (v) ensureWebAudio();
    },
    [ensureWebAudio],
  );

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setPeerId(getOrCreatePeerId('listener'));
    void Promise.all([
      apiFetch<StationStatus>('/public/status').then(setStatus),
      apiFetch<AlwaysOnPlaylist>('/public/autoplay').then(setPlaylist),
    ]).catch(() => setMessage('Unable to reach the control server right now.'));
  }, []);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // ── Audio logic ───────────────────────────────────────────────────────────

  const closePeer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current        = null;
    targetBroadRef.current = null;
    pendingIceRef.current  = [];
    remoteDescSetRef.current = false;
    if (peerRetryTimerRef.current !== null) {
      window.clearTimeout(peerRetryTimerRef.current);
      peerRetryTimerRef.current = null;
    }
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  const stopFallbackAudio = useCallback(() => {
    fallbackModeRef.current = false;
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.removeAttribute('src');
    audioRef.current.load();
  }, []);

  /**
   * Load a fallback track by index and seek to `seekSeconds` if provided.
   * seekSeconds = (Date.now() - alwaysOnState.startedAt) / 1000 for sync.
   */
  const playFallbackTrack = useCallback(
    async (index: number, seekSeconds = 0) => {
      if (!audioRef.current || !playlist?.tracks.length || !enabledRef.current) return;
      const norm  = index % playlist.tracks.length;
      const track = playlist.tracks[norm];
      if (!track) return;
      fallbackModeRef.current    = true;
      audioRef.current.srcObject = null;
      audioRef.current.src       = `${API_BASE}${track.url}`;
      audioRef.current.load();

      // Seek after metadata is available
      const audio = audioRef.current;
      const applySeek = () => {
        if (seekSeconds > 0 && audio.duration > seekSeconds) {
          audio.currentTime = seekSeconds;
        }
      };
      audio.addEventListener('loadedmetadata', applySeek, { once: true });

      try {
        await audio.play();
        setCurrentFallbackIndex(norm);
        setMessage(`Always-on: ${track.title}`);
      } catch {
        setMessage(`Ready: ${track.title}. Tap play if autoplay is blocked.`);
      }
    },
    [playlist],
  );

  const ensureFallbackAudio = useCallback(
    async (trackIndex?: number, startedAt?: number) => {
      if (!playlist?.tracks.length) { setMessage('No tracks available yet.'); return; }
      const idx        = trackIndex ?? currentFallbackIndex;
      const seekSecs   = startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : 0;
      await playFallbackTrack(idx, seekSecs);
    },
    [currentFallbackIndex, playFallbackTrack, playlist],
  );

  const sendJson = useCallback((payload: unknown) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(payload));
  }, []);

  let connectRef: (() => void) | null = null;

  const scheduleReconnect = useCallback(() => {
    if (!enabledRef.current || reconnectTimerRef.current !== null) return;
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      connectRef?.();
    }, 2_000);
  }, []);

  const schedulePeerRetry = useCallback((broadcasterPeerId: string) => {
    if (peerRetryTimerRef.current !== null) return;
    peerRetryTimerRef.current = window.setTimeout(() => {
      peerRetryTimerRef.current = null;
      if (!enabledRef.current || targetBroadRef.current !== null) return;
      void startPeerConnectionRef.current?.(broadcasterPeerId);
    }, 2_000);
  }, []);

  const startPeerConnectionRef = useRef<((id: string) => Promise<void>) | null>(null);

  const startPeerConnection = useCallback(
    async (broadcasterPeerId: string) => {
      if (!peerId || !enabledRef.current) return;
      closePeer();
      setMessage('Connecting to the live stream…');

      const peer = new RTCPeerConnection(rtcConfig);
      peerRef.current        = peer;
      targetBroadRef.current = broadcasterPeerId;

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (audioRef.current) {
          stopFallbackAudio();
          audioRef.current.srcObject = stream ?? new MediaStream([event.track]);
          void audioRef.current.play().catch(() => {
            setMessage('Connected — tap play if audio is silent.');
          });
        }
        setMessage('You are listening live.');
        ensureWebAudio();
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
          schedulePeerRetry(broadcasterPeerId);
        }
      };

      peer.addTransceiver('audio', { direction: 'recvonly' });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendJson({ type: 'sdp_offer', peerId, targetPeerId: broadcasterPeerId, sdp: offer.sdp ?? '' });
    },
    [closePeer, ensureWebAudio, peerId, schedulePeerRetry, sendJson, stopFallbackAudio],
  );

  startPeerConnectionRef.current = startPeerConnection;

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
          // Use server's alwaysOnState so all clients are in sync
          if (enabledRef.current) {
            const aos = payload.alwaysOnState;
            await ensureFallbackAudio(aos?.trackIndex, aos?.startedAt);
          }
          return;
        }

        if (targetBroadRef.current !== payload.broadcasterPeerId) {
          await startPeerConnection(payload.broadcasterPeerId);
        }
        return;
      }

      if (payload.type === 'peer_answer' && peerRef.current) {
        await peerRef.current.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
        remoteDescSetRef.current = true;
        // Drain any ICE candidates that arrived before the answer landed —
        // adding them earlier would have thrown InvalidStateError.
        const queued = pendingIceRef.current;
        pendingIceRef.current = [];
        for (const c of queued) {
          try { await peerRef.current.addIceCandidate(c); } catch { /* ignore stale */ }
        }
        return;
      }

      if (payload.type === 'ice_candidate') {
        if (peerRef.current && remoteDescSetRef.current) {
          try { await peerRef.current.addIceCandidate(payload.candidate); } catch { /* ignore stale */ }
        } else {
          pendingIceRef.current.push(payload.candidate);
        }
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
    if (!enabledRef.current || !peerId) return;
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
        const payload = JSON.parse(event.data as string) as SignalServerMessage;
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
    ws.onerror = () => { setMessage('Signal link failed. Retrying…'); };
  }, [closePeer, handleServerMessage, peerId, scheduleReconnect, sendJson]);

  connectRef = connect;

  useEffect(() => {
    if (!enabled || !peerId) return;
    connect();
    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (peerRetryTimerRef.current !== null) {
        window.clearTimeout(peerRetryTimerRef.current);
        peerRetryTimerRef.current = null;
      }
      sendJson({ type: 'leave', peerId });
      wsRef.current?.close();
      closePeer();
      stopFallbackAudio();
    };
  }, [enabled, peerId]); // intentionally minimal deps — connect is stable

  useEffect(() => {
    if (!enabled || !playlist?.tracks.length || status?.broadcasterPresent) return;
    const aos = status?.alwaysOnState;
    void ensureFallbackAudio(aos?.trackIndex, aos?.startedAt);
  }, [enabled, playlist, status?.broadcasterPresent]);

  /**
   * When a local track ends, tell the server to advance so all clients sync.
   * The server broadcasts back a station_status with the new alwaysOnState.
   */
  const handleTrackEnded = useCallback(() => {
    if (!fallbackModeRef.current) return;
    void apiFetch('/public/autoplay/next', { method: 'POST' }).catch(() => {
      // If the server call fails, just advance locally
      if (playlist?.tracks.length) {
        const next = (currentFallbackIndex + 1) % playlist.tracks.length;
        void playFallbackTrack(next, 0);
      }
    });
  }, [currentFallbackIndex, playFallbackTrack, playlist]);

  const handleVolumeChange = useCallback(
    (val: number) => {
      setVolumeState(val);
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
    },
    [enabled, setEnabled],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    return () => {
      if (ampRafRef.current !== null) cancelAnimationFrame(ampRafRef.current);
      webAudioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <AudioCtx.Provider
      value={{
        enabled,
        connected,
        message,
        status,
        playlist,
        volume,
        currentFallbackIndex,
        audioRef,
        amplitude,
        setEnabled,
        handleVolumeChange,
        handleTrackEnded,
      }}
    >
      <audio ref={audioRef} className="hidden" onEnded={handleTrackEnded} />
      {children}
    </AudioCtx.Provider>
  );
}
