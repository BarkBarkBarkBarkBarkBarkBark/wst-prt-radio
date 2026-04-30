'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  LiveRoomIceCandidate,
  LiveRoomJoinResponse,
  LiveRoomServerEvent,
  LiveRoomSignalEnvelope,
  LiveRoomSnapshot,
} from '@wstprtradio/shared';
import { API_BASE, apiFetch } from '@/lib/api';

interface ParticipantAuth {
  participantId: string;
  participantToken: string;
  displayName: string;
}

type StudioTab = 'listen' | 'stream';

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function toSerializableCandidate(candidate: RTCIceCandidate): LiveRoomIceCandidate {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment ?? null,
  };
}

export function OpenMicStudio() {
  const [activeTab, setActiveTab] = useState<StudioTab>('listen');
  const [room, setRoom] = useState<LiveRoomSnapshot | null>(null);
  const [auth, setAuth] = useState<ParticipantAuth | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [hostSecret, setHostSecret] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const [configTitle, setConfigTitle] = useState('');
  const [configPassphrase, setConfigPassphrase] = useState('');
  const [configAccessMode, setConfigAccessMode] = useState<'open' | 'passphrase'>('open');
  const [configBroadcastMode, setConfigBroadcastMode] = useState<'open_mic' | 'official'>('open_mic');

  const authRef = useRef<ParticipantAuth | null>(null);
  const roomRef = useRef<LiveRoomSnapshot | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const listenerPeerRef = useRef<RTCPeerConnection | null>(null);
  const listenerTargetRef = useRef<string | null>(null);
  const broadcasterPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const selfParticipant = useMemo(
    () => room?.participants.find((participant) => participant.id === auth?.participantId) ?? null,
    [auth?.participantId, room?.participants],
  );
  const isHost = room?.hostParticipantId === auth?.participantId;
  const isBroadcaster = room?.activeBroadcasterId === auth?.participantId;

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    roomRef.current = room;
    if (room) {
      setConfigTitle(room.title);
      setConfigPassphrase(room.passphraseRequired ? configPassphrase : '');
      setConfigAccessMode(room.accessMode);
      setConfigBroadcastMode(room.broadcastMode);
    }
  }, [room]);

  const loadRoom = useCallback(async () => {
    try {
      const snapshot = await apiFetch<LiveRoomSnapshot>('/public/live-room');
      setRoom(snapshot);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Failed to load room');
    }
  }, []);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  const closeListenerPeer = useCallback(() => {
    listenerPeerRef.current?.close();
    listenerPeerRef.current = null;
    listenerTargetRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const closeBroadcasterPeers = useCallback(() => {
    for (const connection of broadcasterPeersRef.current.values()) {
      connection.close();
    }
    broadcasterPeersRef.current.clear();
  }, []);

  const stopLocalStream = useCallback(() => {
    for (const track of localStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    localStreamRef.current = null;
    setLocalStreamReady(false);
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }
  }, []);

  const sendAuthedPost = useCallback(
    async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
      if (!authRef.current) throw new Error('Join the room first');
      return apiFetch<T>(path, {
        method: 'POST',
        body: JSON.stringify({
          participantId: authRef.current.participantId,
          participantToken: authRef.current.participantToken,
          ...body,
        }),
      });
    },
    [],
  );

  const sendSignal = useCallback(
    async (payload: Omit<LiveRoomSignalEnvelope, 'fromParticipantId'>) => {
      await sendAuthedPost('/public/live-room/signal', payload);
    },
    [sendAuthedPost],
  );

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    localStreamRef.current = stream;
    setLocalStreamReady(true);
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  const handleBroadcasterOffer = useCallback(
    async (signal: LiveRoomSignalEnvelope) => {
      if (!isBroadcaster) return;
      const localStream = await ensureLocalStream();
      let connection = broadcasterPeersRef.current.get(signal.fromParticipantId);
      if (!connection) {
        connection = new RTCPeerConnection(rtcConfig);
        for (const track of localStream.getTracks()) {
          connection.addTrack(track, localStream);
        }
        connection.onicecandidate = (event) => {
          if (!event.candidate) return;
          void sendSignal({
            type: 'ice-candidate',
            toParticipantId: signal.fromParticipantId,
            candidate: toSerializableCandidate(event.candidate),
          });
        };
        broadcasterPeersRef.current.set(signal.fromParticipantId, connection);
      }

      if (signal.sdp) {
        await connection.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        await sendSignal({
          type: 'answer',
          toParticipantId: signal.fromParticipantId,
          sdp: answer.sdp ?? '',
        });
      }
    },
    [ensureLocalStream, isBroadcaster, sendSignal],
  );

  const handleSignal = useCallback(
    async (signal: LiveRoomSignalEnvelope) => {
      if (authRef.current?.participantId !== signal.toParticipantId) return;

      if (roomRef.current?.activeBroadcasterId === authRef.current?.participantId) {
        if (signal.type === 'offer') {
          await handleBroadcasterOffer(signal);
          return;
        }

        if (signal.type === 'ice-candidate') {
          const connection = broadcasterPeersRef.current.get(signal.fromParticipantId);
          if (connection && signal.candidate) {
            await connection.addIceCandidate(signal.candidate);
          }
        }
        return;
      }

      if (!listenerPeerRef.current) return;

      if (signal.type === 'answer' && signal.sdp) {
        await listenerPeerRef.current.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      }

      if (signal.type === 'ice-candidate' && signal.candidate) {
        await listenerPeerRef.current.addIceCandidate(signal.candidate);
      }
    },
    [handleBroadcasterOffer],
  );

  const connectEventStream = useCallback(
    (participantId: string, participantToken: string) => {
      eventSourceRef.current?.close();
      const source = new EventSource(
        `${API_BASE}/public/live-room/events?participantId=${encodeURIComponent(participantId)}&participantToken=${encodeURIComponent(participantToken)}`,
      );
      source.onmessage = (event) => {
        const payload = JSON.parse(event.data) as LiveRoomServerEvent;
        if (payload.type === 'room.snapshot') {
          setRoom(payload.room);
          return;
        }
        if (payload.type === 'room.notice') {
          setStatusMessage(payload.message);
          return;
        }
        if (payload.type === 'room.signal') {
          void handleSignal(payload.signal).catch((error) => {
            setStatusMessage(error instanceof Error ? error.message : 'Signal error');
          });
        }
      };
      source.onerror = () => {
        setStatusMessage('Realtime link interrupted. Rejoin the room if the page goes stale.');
      };
      eventSourceRef.current = source;
    },
    [handleSignal],
  );

  const joinRoom = useCallback(async () => {
    setJoinError('');
    setIsJoining(true);
    try {
      const result = await apiFetch<LiveRoomJoinResponse>('/public/live-room/join', {
        method: 'POST',
        body: JSON.stringify({ displayName, passphrase }),
      });
      const nextAuth = {
        participantId: result.participantId,
        participantToken: result.participantToken,
        displayName: displayName.trim(),
      };
      setAuth(nextAuth);
      setRoom(result.room);
      connectEventStream(result.participantId, result.participantToken);
      setStatusMessage('Joined the room.');
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  }, [connectEventStream, displayName, passphrase]);

  const leaveRoom = useCallback(async () => {
    if (!authRef.current) return;
    try {
      await sendAuthedPost('/public/live-room/leave', {});
    } catch {
      // ignore on best-effort cleanup
    }
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    closeListenerPeer();
    closeBroadcasterPeers();
    stopLocalStream();
    setAuth(null);
    await loadRoom();
  }, [closeBroadcasterPeers, closeListenerPeer, loadRoom, sendAuthedPost, stopLocalStream]);

  useEffect(() => {
    return () => {
      void leaveRoom();
    };
  }, [leaveRoom]);

  useEffect(() => {
    if (!auth || !room || !room.activeBroadcasterId || room.activeBroadcasterId === auth.participantId) {
      closeListenerPeer();
      return;
    }

    if (listenerTargetRef.current === room.activeBroadcasterId && listenerPeerRef.current) {
      return;
    }

    closeListenerPeer();
    const broadcasterId = room.activeBroadcasterId;
    const connection = new RTCPeerConnection(rtcConfig);
    listenerPeerRef.current = connection;
    listenerTargetRef.current = broadcasterId;

    connection.ontrack = (event) => {
      const [stream] = event.streams;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream ?? new MediaStream([event.track]);
      }
    };

    connection.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendSignal({
        type: 'ice-candidate',
        toParticipantId: broadcasterId,
        candidate: toSerializableCandidate(event.candidate),
      });
    };

    connection.addTransceiver('audio', { direction: 'recvonly' });

    void (async () => {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await sendSignal({ type: 'offer', toParticipantId: broadcasterId, sdp: offer.sdp ?? '' });
    })().catch((error) => {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to connect to broadcast');
    });
  }, [auth, closeListenerPeer, room, sendSignal]);

  useEffect(() => {
    if (!isBroadcaster) {
      closeBroadcasterPeers();
    }
  }, [closeBroadcasterPeers, isBroadcaster]);

  const claimHost = useCallback(async () => {
    try {
      const snapshot = await sendAuthedPost<LiveRoomSnapshot>('/public/live-room/claim-host', { hostSecret });
      setRoom(snapshot);
      setStatusMessage('You are now the room host.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to claim host');
    }
  }, [hostSecret, sendAuthedPost]);

  const saveRoomConfig = useCallback(async () => {
    try {
      const snapshot = await sendAuthedPost<LiveRoomSnapshot>('/public/live-room/configure', {
        title: configTitle,
        accessMode: configAccessMode,
        broadcastMode: configBroadcastMode,
        passphrase: configAccessMode === 'passphrase' ? configPassphrase : '',
      });
      setRoom(snapshot);
      setStatusMessage('Room settings updated.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to update room');
    }
  }, [configAccessMode, configBroadcastMode, configPassphrase, configTitle, sendAuthedPost]);

  const startBroadcast = useCallback(async () => {
    try {
      await ensureLocalStream();
      const snapshot = await sendAuthedPost<LiveRoomSnapshot>('/public/live-room/broadcast/start', {});
      setRoom(snapshot);
      setStatusMessage('You are live.');
      setActiveTab('stream');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to go live');
    }
  }, [ensureLocalStream, sendAuthedPost]);

  const stopBroadcast = useCallback(async () => {
    try {
      const snapshot = await sendAuthedPost<LiveRoomSnapshot>('/public/live-room/broadcast/stop', {});
      setRoom(snapshot);
      closeBroadcasterPeers();
      setStatusMessage('Broadcast ended.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to stop broadcast');
    }
  }, [closeBroadcasterPeers, sendAuthedPost]);

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-stone-300/70 bg-white/70 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.04)] backdrop-blur-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-accent-red">Unified live room</p>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-ink">{room?.title ?? 'West Port Open Mic'}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                One window to listen, one tab to speak. Join as a listener, claim the mic when the room is open,
                or lock things down for an official hosted stream.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-paper/80 px-4 py-3 text-sm text-muted">
            <p><span className="font-semibold text-ink">Mode:</span> {room?.broadcastMode === 'official' ? 'Official broadcast' : 'Open mic'}</p>
            <p><span className="font-semibold text-ink">Access:</span> {room?.accessMode === 'passphrase' ? 'Secret word required' : 'Open room'}</p>
            <p><span className="font-semibold text-ink">Live now:</span> {room?.activeBroadcasterId ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </div>

      {!auth ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-stone-300/70 bg-white/70 p-6">
            <h3 className="text-xl font-semibold text-ink">Join the room</h3>
            <div className="mt-5 grid gap-4">
              <label className="space-y-2 text-sm text-muted">
                <span className="font-medium text-ink">Display name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-paper px-4 py-3 text-ink outline-none focus:border-accent-red"
                  placeholder="sailor_dog"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span className="font-medium text-ink">Secret word {room?.passphraseRequired ? '(required)' : '(optional)'}</span>
                <input
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-paper px-4 py-3 text-ink outline-none focus:border-accent-red"
                  placeholder={room?.passphraseRequired ? 'open-mic-word' : 'Only needed if the room is locked'}
                />
              </label>
              {joinError && <p className="text-sm text-accent-red">{joinError}</p>}
              <button
                type="button"
                onClick={() => void joinRoom()}
                disabled={isJoining || !displayName.trim()}
                className="inline-flex w-fit items-center rounded-full border border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-accent-red hover:border-accent-red disabled:opacity-50"
              >
                {isJoining ? 'Joining…' : 'Enter the room'}
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-300/70 bg-paper/80 p-6">
            <h3 className="text-xl font-semibold text-ink">How this works</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
              <li>• Everyone joins the same room and can hear the active broadcaster in-browser.</li>
              <li>• In <span className="font-medium text-ink">open mic</span> mode, anyone can grab the mic if nobody else is live.</li>
              <li>• In <span className="font-medium text-ink">official</span> mode, only the host can go live.</li>
              <li>• The host can protect the room with a secret word and change the rules on the fly.</li>
            </ul>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-stone-300 bg-paper px-4 py-2 text-sm text-muted">
              Signed in as <span className="font-semibold text-ink">{auth.displayName}</span>
              {selfParticipant ? ` · ${selfParticipant.role}` : ''}
            </div>
            <button
              type="button"
              onClick={() => void leaveRoom()}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-ink transition hover:border-accent-red hover:text-accent-red"
            >
              Leave room
            </button>
            {!isHost && (
              <div className="flex items-center gap-2 rounded-full border border-stone-300 bg-white/70 px-3 py-2 text-sm">
                <input
                  value={hostSecret}
                  onChange={(event) => setHostSecret(event.target.value)}
                  placeholder="Host secret"
                  className="w-32 bg-transparent text-ink outline-none placeholder:text-muted"
                />
                <button type="button" onClick={() => void claimHost()} className="font-semibold text-accent-red">
                  Claim host
                </button>
              </div>
            )}
          </div>

          {statusMessage && <p className="rounded-xl border border-stone-300 bg-white/70 px-4 py-3 text-sm text-muted">{statusMessage}</p>}

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-stone-300/70 bg-white/70 p-6">
                <div className="flex items-center gap-2 rounded-full border border-stone-300 bg-paper p-1 text-sm text-muted w-fit">
                  <button
                    type="button"
                    onClick={() => setActiveTab('listen')}
                    className={`rounded-full px-4 py-2 transition ${activeTab === 'listen' ? 'bg-ink text-paper' : ''}`}
                  >
                    Listen
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('stream')}
                    className={`rounded-full px-4 py-2 transition ${activeTab === 'stream' ? 'bg-ink text-paper' : ''}`}
                  >
                    Stream
                  </button>
                </div>

                {activeTab === 'listen' ? (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border border-stone-200 bg-paper p-5">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-accent-red">Listen tab</p>
                      <p className="mt-2 text-lg font-semibold text-ink">
                        {room?.activeBroadcasterId
                          ? `Now hearing ${room.participants.find((participant) => participant.id === room.activeBroadcasterId)?.displayName ?? 'the current speaker'}`
                          : 'Nobody is on mic right now'}
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        Keep this tab open to listen. When someone takes the stage, audio arrives here without leaving the page.
                      </p>
                    </div>
                    <audio ref={remoteAudioRef} autoPlay playsInline controls className="w-full" />
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border border-stone-200 bg-paper p-5">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-accent-red">Stream tab</p>
                      <p className="mt-2 text-lg font-semibold text-ink">
                        {isBroadcaster ? 'You are live right now.' : 'Prepare your mic, then take the stage.'}
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        In open mic mode, anyone can go live if the stage is empty. In official mode, only the host can broadcast.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void ensureLocalStream().catch((error) => setStatusMessage(error instanceof Error ? error.message : 'Mic access failed'))}
                        className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-ink transition hover:border-accent-red hover:text-accent-red"
                      >
                        {localStreamReady ? 'Mic ready' : 'Prepare mic'}
                      </button>
                      {isBroadcaster ? (
                        <button
                          type="button"
                          onClick={() => void stopBroadcast()}
                          className="rounded-full border border-accent-red bg-accent-red px-4 py-2 text-sm font-semibold text-paper"
                        >
                          Stop broadcast
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void startBroadcast()}
                          className="rounded-full border border-ink bg-ink px-4 py-2 text-sm font-semibold text-paper"
                        >
                          Go live
                        </button>
                      )}
                    </div>
                    <audio ref={localAudioRef} autoPlay muted playsInline controls className="w-full" />
                  </div>
                )}
              </div>

              {isHost && (
                <div className="rounded-[2rem] border border-stone-300/70 bg-paper/80 p-6 space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-accent-red">Host controls</p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">Room rules</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-muted md:col-span-2">
                      <span className="font-medium text-ink">Room title</span>
                      <input value={configTitle} onChange={(event) => setConfigTitle(event.target.value)} className="w-full rounded-xl border border-stone-300 bg-white/70 px-4 py-3 text-ink outline-none focus:border-accent-red" />
                    </label>
                    <label className="space-y-2 text-sm text-muted">
                      <span className="font-medium text-ink">Access</span>
                      <select value={configAccessMode} onChange={(event) => setConfigAccessMode(event.target.value as 'open' | 'passphrase')} className="w-full rounded-xl border border-stone-300 bg-white/70 px-4 py-3 text-ink outline-none focus:border-accent-red">
                        <option value="open">Open</option>
                        <option value="passphrase">Secret word</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-muted">
                      <span className="font-medium text-ink">Broadcast mode</span>
                      <select value={configBroadcastMode} onChange={(event) => setConfigBroadcastMode(event.target.value as 'open_mic' | 'official')} className="w-full rounded-xl border border-stone-300 bg-white/70 px-4 py-3 text-ink outline-none focus:border-accent-red">
                        <option value="open_mic">Open mic</option>
                        <option value="official">Official only</option>
                      </select>
                    </label>
                    {configAccessMode === 'passphrase' && (
                      <label className="space-y-2 text-sm text-muted md:col-span-2">
                        <span className="font-medium text-ink">Secret word</span>
                        <input value={configPassphrase} onChange={(event) => setConfigPassphrase(event.target.value)} className="w-full rounded-xl border border-stone-300 bg-white/70 px-4 py-3 text-ink outline-none focus:border-accent-red" />
                      </label>
                    )}
                  </div>
                  <button type="button" onClick={() => void saveRoomConfig()} className="rounded-full border border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
                    Save room settings
                  </button>
                </div>
              )}
            </div>

            <aside className="space-y-6">
              <div className="rounded-[2rem] border border-stone-300/70 bg-white/70 p-6">
                <p className="text-[11px] uppercase tracking-[0.28em] text-accent-red">Room roster</p>
                <ul className="mt-4 space-y-3">
                  {room?.participants.map((participant) => (
                    <li key={participant.id} className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-paper px-4 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-ink">{participant.displayName}</p>
                        <p className="text-muted">{participant.role === 'host' ? 'Host' : participant.role === 'speaker' ? 'On mic' : 'Listening'}</p>
                      </div>
                      {participant.isActiveBroadcaster && <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-red">Live</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[2rem] border border-stone-300/70 bg-paper/80 p-6 text-sm leading-6 text-muted">
                <p className="text-[11px] uppercase tracking-[0.28em] text-accent-red">Notes</p>
                <ul className="mt-3 space-y-2">
                  <li>• This is an intentionally messy, low-friction open mic prototype.</li>
                  <li>• One broadcaster at a time keeps the first version stable.</li>
                  <li>• Later we can add queues, moderation, and archival recording.</li>
                </ul>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
