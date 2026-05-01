'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SignalServerMessage, StationStatus } from '@wstprtradio/shared';
import { getSignalUrl, apiFetch } from '@/lib/api';
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

export function StreamClient() {
  const [peerId, setPeerId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<StationStatus | null>(null);
  const [message, setMessage] = useState('When the station is open, tap start and allow the mic.');
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const monitorRef = useRef<HTMLAudioElement | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  useEffect(() => {
    setPeerId(getOrCreatePeerId());
    void apiFetch<StationStatus>('/public/status').then(setStatus).catch(() => undefined);
  }, []);

  const sendJson = useCallback((payload: unknown) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    wsRef.current.send(JSON.stringify(payload));
  }, []);

  const stopAllPeers = useCallback(() => {
    for (const peer of peersRef.current.values()) {
      peer.close();
    }
    peersRef.current.clear();
  }, []);

  const stopLocalStream = useCallback(() => {
    for (const track of localStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    localStreamRef.current = null;
    if (monitorRef.current) {
      monitorRef.current.srcObject = null;
    }
  }, []);

  const teardown = useCallback(() => {
    sendJson({ type: 'leave', peerId });
    stopAllPeers();
    stopLocalStream();
    wsRef.current?.close();
    wsRef.current = null;
    setIsLive(false);
    setIsStarting(false);
  }, [peerId, sendJson, stopAllPeers, stopLocalStream]);

  const handleListenerOffer = useCallback(
    async (fromPeerId: string, sdp: string) => {
      const localStream = localStreamRef.current;
      if (!localStream) {
        return;
      }

      let peer = peersRef.current.get(fromPeerId);
      if (!peer) {
        peer = new RTCPeerConnection(rtcConfig);
        for (const track of localStream.getTracks()) {
          peer.addTrack(track, localStream);
        }
        peer.onicecandidate = (event) => {
          if (!event.candidate) return;
          sendJson({
            type: 'ice_candidate',
            peerId,
            targetPeerId: fromPeerId,
            candidate: serializeCandidate(event.candidate),
          });
        };
        peer.onconnectionstatechange = () => {
          if (peer?.connectionState === 'closed' || peer?.connectionState === 'failed' || peer?.connectionState === 'disconnected') {
            peersRef.current.delete(fromPeerId);
          }
        };
        peersRef.current.set(fromPeerId, peer);
      }

      await peer.setRemoteDescription({ type: 'offer', sdp });
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendJson({ type: 'sdp_answer', peerId, targetPeerId: fromPeerId, sdp: answer.sdp ?? '' });
    },
    [peerId, sendJson],
  );

  const handleServerMessage = useCallback(
    async (payload: SignalServerMessage) => {
      if (payload.type === 'station_status') {
        setStatus(payload);
        if (!payload.broadcasterPresent && isLive) {
          setMessage('Your live session ended.');
          setIsLive(false);
        }
        return;
      }

      if (payload.type === 'broadcaster_accepted') {
        setIsLive(true);
        setIsStarting(false);
        setMessage(`You are live. Session ${payload.liveSessionId}`);
        return;
      }

      if (payload.type === 'broadcaster_rejected') {
        setIsStarting(false);
        setMessage(payload.reason);
        stopAllPeers();
        stopLocalStream();
        return;
      }

      if (payload.type === 'peer_offer') {
        await handleListenerOffer(payload.fromPeerId, payload.sdp);
        return;
      }

      if (payload.type === 'ice_candidate') {
        const peer = peersRef.current.get(payload.fromPeerId);
        if (peer) {
          await peer.addIceCandidate(payload.candidate);
        }
        return;
      }

      if (payload.type === 'force_disconnect') {
        setMessage(payload.reason);
        teardown();
      }
    },
    [handleListenerOffer, isLive, stopAllPeers, stopLocalStream, teardown],
  );

  const connectSocket = useCallback(() => {
    if (!peerId) {
      return;
    }

    wsRef.current?.close();
    const ws = new WebSocket(getSignalUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      sendJson({
        type: 'join_as_broadcaster',
        peerId,
        displayName: displayName.trim() || undefined,
      });
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
      if (isLive) {
        setMessage('Disconnected from the control server.');
      }
      setIsLive(false);
      setIsStarting(false);
      stopAllPeers();
    };
  }, [displayName, handleServerMessage, isLive, peerId, sendJson, stopAllPeers]);

  const start = useCallback(async () => {
    if (!peerId) {
      return;
    }

    setIsStarting(true);
    setMessage('Requesting microphone access…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      if (monitorRef.current) {
        monitorRef.current.srcObject = stream;
      }
      connectSocket();
    } catch {
      setIsStarting(false);
      setMessage('Microphone access was denied.');
    }
  }, [connectSocket, peerId]);

  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <StatusBadge state={status?.stationState ?? 'closed'} />
            <h2 className="text-3xl font-semibold text-ink">Broadcaster</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Anonymous by default. Tap start, allow microphone access, and you become the single live broadcaster when the station is open.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void start()}
              disabled={isStarting || isLive}
              className="rounded-full border border-ink bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:border-accent-red hover:bg-accent-red disabled:opacity-50"
            >
              {isLive ? 'Live now' : isStarting ? 'Starting…' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => teardown()}
              className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-ink transition hover:border-accent-red hover:text-accent-red"
            >
              Stop
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-stone-300/70 bg-paper/90 p-6">
          <label className="block text-sm text-muted">
            Display name (optional)
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-ink outline-none focus:border-accent-red"
              placeholder="DJ Dogboat"
              maxLength={80}
            />
          </label>

          <audio ref={monitorRef} muted autoPlay className="mt-4 w-full" />

          <div className="mt-4 space-y-2 text-sm text-muted">
            <p>{message}</p>
            <p>{status?.listenerCount ?? 0} listener{status?.listenerCount === 1 ? '' : 's'} connected.</p>
            <p>{status?.broadcasterPresent ? 'A broadcaster is attached.' : 'The slot is free.'}</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-stone-300/70 bg-white/70 p-6 text-sm text-muted">
          <h3 className="text-lg font-semibold text-ink">Rules</h3>
          <ul className="mt-4 space-y-3 leading-6">
            <li>• One broadcaster at a time for v1.</li>
            <li>• The station starts open by default.</li>
            <li>• If another broadcaster is already live, you will be rejected.</li>
            <li>• If your browser is blocked, this page will tell you directly.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
