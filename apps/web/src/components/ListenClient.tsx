'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlwaysOnPlaylist, SignalServerMessage, StationStatus } from '@wstprtradio/shared';
import { API_BASE, getSignalUrl, apiFetch } from '@/lib/api';
import { getOrCreatePeerId } from '@/lib/peerId';
import { StatusBadge } from './StatusBadge';

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

export function ListenClient() {
  const [status, setStatus] = useState<StationStatus | null>(null);
  const [playlist, setPlaylist] = useState<AlwaysOnPlaylist | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('Tap listen to connect to the station.');
  const [peerId, setPeerId] = useState('');
  const [connected, setConnected] = useState(false);
  const [currentFallbackIndex, setCurrentFallbackIndex] = useState(0);

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
        setMessage(`Ready: ${track.title}`);
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

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <StatusBadge state={status?.stationState ?? 'closed'} />
            <h2 className="text-3xl font-semibold text-ink">Listener</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Open the page, tap listen, and stay attached to the live broadcaster. The player auto-recovers when the stream drops.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(true)}
            className="rounded-full border border-ink bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:border-accent-red hover:bg-accent-red"
          >
            {enabled ? 'Listening…' : 'Listen'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[2rem] border border-stone-300/70 bg-paper/90 p-6">
          <audio ref={audioRef} controls className="w-full" onEnded={() => void handleTrackEnded()} />
          <div className="mt-4 space-y-2 text-sm text-muted">
            <p>{message}</p>
            <p>
              {status?.broadcasterPresent ? 'Broadcaster online.' : 'No broadcaster connected.'} {status ? `${status.listenerCount} listener${status.listenerCount === 1 ? '' : 's'}.` : ''}
            </p>
            <p>{connected ? 'Signal connected.' : 'Signal idle.'}</p>
            <p>{playlist?.tracks.length ? `${playlist.tracks.length} always-on tracks from Fly.` : 'No always-on tracks loaded.'}</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-stone-300/70 bg-white/70 p-6 text-sm text-muted">
          <h3 className="text-lg font-semibold text-ink">Station state</h3>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="uppercase tracking-[0.24em] text-xs">Live session</dt>
              <dd className="mt-1 text-ink">{status?.liveSessionId ?? 'Idle'}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.24em] text-xs">Broadcaster</dt>
              <dd className="mt-1 text-ink">{status?.broadcasterDisplayName ?? 'Nobody live'}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.24em] text-xs">Listeners</dt>
              <dd className="mt-1 text-ink">{status?.listenerCount ?? 0}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
