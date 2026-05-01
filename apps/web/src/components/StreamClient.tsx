'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SignalServerMessage, StationStatus } from '@wstprtradio/shared';
import { getSignalUrl, apiFetch } from '@/lib/api';
import { getOrCreatePeerId } from '@/lib/peerId';
import { StatusBadge } from './StatusBadge';

// STUN = discovers your public IP/port behind NAT
// TURN = relays traffic when direct peer-to-peer fails (strict firewalls)
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

interface ListenerPeerEntry {
  pc: RTCPeerConnection;
  remoteDescSet: boolean;
  pendingIce: RTCIceCandidateInit[];
}

interface GuestPeerEntry {
  pc: RTCPeerConnection;
  remoteDescSet: boolean;
  pendingIce: RTCIceCandidateInit[];
  sourceNode: MediaStreamAudioSourceNode | null;
}

function serializeCandidate(candidate: RTCIceCandidate) {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment ?? null,
  };
}

export function StreamClient() {
  const [peerId] = useState(() => getOrCreatePeerId('broadcaster'));
  const [status, setStatus] = useState<StationStatus | null>(null);

  // host state
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('When the station is open, tap start and allow the mic.');
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [allowGuests, setAllowGuests] = useState(false);

  // guest state
  const [guestPeerId] = useState(() => getOrCreatePeerId('guest'));
  const [guestDisplayName, setGuestDisplayName] = useState('');
  const [guestStatus, setGuestStatus] = useState<'idle' | 'joining' | 'live' | 'rejected'>('idle');
  const [guestMessage, setGuestMessage] = useState('');

  // audio device picker
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [hostDeviceId, setHostDeviceId] = useState('');
  const [guestDeviceId, setGuestDeviceId] = useState('');

  // host refs
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const monitorRef = useRef<HTMLAudioElement | null>(null);
  const peersRef = useRef<Map<string, ListenerPeerEntry>>(new Map());
  const earlyIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Web Audio mixer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mixerDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const hostSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const guestPeersRef = useRef<Map<string, GuestPeerEntry>>(new Map());
  const guestEarlyIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // guest refs
  const guestWsRef = useRef<WebSocket | null>(null);
  const guestPcRef = useRef<RTCPeerConnection | null>(null);
  const guestStreamRef = useRef<MediaStream | null>(null);
  const guestAudioRef = useRef<HTMLAudioElement | null>(null);
  const guestEarlyIceBufRef = useRef<RTCIceCandidateInit[]>([]);
  const guestRemoteDescSetRef = useRef(false);

  useEffect(() => {
    void apiFetch<StationStatus>('/public/status').then(setStatus).catch(() => undefined);
  }, []);

  const enumerateAudioInputs = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
    } catch { /* permissions not yet granted, will retry after first getUserMedia */ }
  }, []);

  useEffect(() => {
    void enumerateAudioInputs();
    navigator.mediaDevices.addEventListener('devicechange', enumerateAudioInputs);
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerateAudioInputs);
  }, [enumerateAudioInputs]);

  // HOST

  const sendJson = useCallback((payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(payload));
  }, []);

  const getOutboundStream = useCallback((): MediaStream | null => {
    return mixerDestRef.current?.stream ?? localStreamRef.current;
  }, []);

  const stopAllListenerPeers = useCallback(() => {
    for (const e of peersRef.current.values()) e.pc.close();
    peersRef.current.clear();
    earlyIceRef.current.clear();
  }, []);

  const stopAllGuestPeers = useCallback(() => {
    for (const e of guestPeersRef.current.values()) {
      e.sourceNode?.disconnect();
      e.pc.close();
    }
    guestPeersRef.current.clear();
    guestEarlyIceRef.current.clear();
  }, []);

  const teardownMixer = useCallback(() => {
    hostSourceRef.current?.disconnect();
    hostSourceRef.current = null;
    mixerDestRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  }, []);

  const stopLocalStream = useCallback(() => {
    for (const t of localStreamRef.current?.getTracks() ?? []) t.stop();
    localStreamRef.current = null;
    if (monitorRef.current) monitorRef.current.srcObject = null;
    teardownMixer();
  }, [teardownMixer]);

  const teardown = useCallback(() => {
    sendJson({ type: 'leave', peerId });
    stopAllListenerPeers();
    stopAllGuestPeers();
    stopLocalStream();
    wsRef.current?.close();
    wsRef.current = null;
    setIsLive(false);
    setIsStarting(false);
    setAllowGuests(false);
  }, [peerId, sendJson, stopAllGuestPeers, stopAllListenerPeers, stopLocalStream]);

  const ensureMixer = useCallback((micStream: MediaStream) => {
    if (audioCtxRef.current) return;
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createMediaStreamSource(micStream);
    src.connect(dest);
    audioCtxRef.current = ctx;
    mixerDestRef.current = dest;
    hostSourceRef.current = src;
  }, []);

  const handleListenerOffer = useCallback(
    async (fromPeerId: string, sdp: string) => {
      const outbound = getOutboundStream();
      if (!outbound) return;
      let entry = peersRef.current.get(fromPeerId);
      if (!entry) {
        const pc = new RTCPeerConnection(rtcConfig);
        entry = { pc, remoteDescSet: false, pendingIce: [] };
        for (const track of outbound.getTracks()) pc.addTrack(track, outbound);
        pc.onicecandidate = (ev) => {
          if (!ev.candidate) return;
          sendJson({ type: 'ice_candidate', peerId, targetPeerId: fromPeerId, candidate: serializeCandidate(ev.candidate) });
        };
        pc.onconnectionstatechange = () => {
          if (['closed', 'failed', 'disconnected'].includes(pc.connectionState)) peersRef.current.delete(fromPeerId);
        };
        peersRef.current.set(fromPeerId, entry);
      }
      await entry.pc.setRemoteDescription({ type: 'offer', sdp });
      entry.remoteDescSet = true;
      for (const c of earlyIceRef.current.get(fromPeerId) ?? []) { try { await entry.pc.addIceCandidate(c); } catch { /* stale */ } }
      earlyIceRef.current.delete(fromPeerId);
      for (const c of entry.pendingIce.splice(0)) { try { await entry.pc.addIceCandidate(c); } catch { /* stale */ } }
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      sendJson({ type: 'sdp_answer', peerId, targetPeerId: fromPeerId, sdp: answer.sdp ?? '' });
    },
    [getOutboundStream, peerId, sendJson],
  );

  const handleGuestOffer = useCallback(
    async (fromPeerId: string, sdp: string) => {
      const outbound = getOutboundStream();
      if (!outbound || !audioCtxRef.current || !mixerDestRef.current) return;
      let entry = guestPeersRef.current.get(fromPeerId);
      if (!entry) {
        const pc = new RTCPeerConnection(rtcConfig);
        entry = { pc, remoteDescSet: false, pendingIce: [], sourceNode: null };
        for (const track of outbound.getTracks()) pc.addTrack(track, outbound);
        pc.ontrack = (ev) => {
          if (!audioCtxRef.current || !mixerDestRef.current) return;
          const guestStream = ev.streams[0] ?? new MediaStream([ev.track]);
          const src = audioCtxRef.current.createMediaStreamSource(guestStream);
          src.connect(mixerDestRef.current);
          if (entry) entry.sourceNode = src;
        };
        pc.onicecandidate = (ev) => {
          if (!ev.candidate) return;
          sendJson({ type: 'ice_candidate', peerId, targetPeerId: fromPeerId, candidate: serializeCandidate(ev.candidate) });
        };
        pc.onconnectionstatechange = () => {
          if (['closed', 'failed', 'disconnected'].includes(pc.connectionState)) {
            guestPeersRef.current.get(fromPeerId)?.sourceNode?.disconnect();
            guestPeersRef.current.delete(fromPeerId);
          }
        };
        guestPeersRef.current.set(fromPeerId, entry);
      }
      await entry.pc.setRemoteDescription({ type: 'offer', sdp });
      entry.remoteDescSet = true;
      for (const c of guestEarlyIceRef.current.get(fromPeerId) ?? []) { try { await entry.pc.addIceCandidate(c); } catch { /* stale */ } }
      guestEarlyIceRef.current.delete(fromPeerId);
      for (const c of entry.pendingIce.splice(0)) { try { await entry.pc.addIceCandidate(c); } catch { /* stale */ } }
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      sendJson({ type: 'sdp_answer', peerId, targetPeerId: fromPeerId, sdp: answer.sdp ?? '' });
    },
    [getOutboundStream, peerId, sendJson],
  );

  const handleServerMessage = useCallback(
    async (payload: SignalServerMessage) => {
      if (payload.type === 'station_status') {
        setStatus(payload as unknown as StationStatus);
        if (!payload.broadcasterPresent && isLive) { setMessage('Your live session ended.'); setIsLive(false); }
        return;
      }
      if (payload.type === 'broadcaster_accepted') {
        setIsLive(true); setIsStarting(false); setMessage(`You are live. Session ${payload.liveSessionId}`);
        return;
      }
      if (payload.type === 'broadcaster_rejected') {
        setIsStarting(false); setMessage(payload.reason); stopAllListenerPeers(); stopLocalStream();
        return;
      }
      if (payload.type === 'peer_offer') {
        if (payload.fromRole === 'guest') { await handleGuestOffer(payload.fromPeerId, payload.sdp); }
        else { await handleListenerOffer(payload.fromPeerId, payload.sdp); }
        return;
      }
      if (payload.type === 'ice_candidate') {
        const fp = payload.fromPeerId;
        const ge = guestPeersRef.current.get(fp);
        if (ge) {
          if (ge.remoteDescSet) { try { await ge.pc.addIceCandidate(payload.candidate); } catch { /* stale */ } } else { ge.pendingIce.push(payload.candidate); }
          return;
        }
        const le = peersRef.current.get(fp);
        if (!le) {
          const list = earlyIceRef.current.get(fp) ?? []; list.push(payload.candidate); earlyIceRef.current.set(fp, list);
          return;
        }
        if (le.remoteDescSet) { try { await le.pc.addIceCandidate(payload.candidate); } catch { /* stale */ } } else { le.pendingIce.push(payload.candidate); }
        return;
      }
      if (payload.type === 'force_disconnect') { setMessage(payload.reason); teardown(); }
    },
    [handleGuestOffer, handleListenerOffer, isLive, stopAllListenerPeers, stopLocalStream, teardown],
  );

  const connectSocket = useCallback(() => {
    if (!peerId) return;
    wsRef.current?.close();
    const ws = new WebSocket(getSignalUrl());
    wsRef.current = ws;
    ws.onopen = () => sendJson({ type: 'join_as_broadcaster', peerId, displayName: displayName.trim() || undefined });
    ws.onmessage = (ev) => { try { void handleServerMessage(JSON.parse(ev.data) as SignalServerMessage); } catch { setMessage('Invalid server message.'); } };
    ws.onclose = () => { if (isLive) setMessage('Disconnected.'); setIsLive(false); setIsStarting(false); stopAllListenerPeers(); };
  }, [displayName, handleServerMessage, isLive, peerId, sendJson, stopAllListenerPeers]);

  const start = useCallback(async () => {
    if (!peerId) return;
    setIsStarting(true); setMessage('Requesting microphone access\u2026');
    try {
      const isInterface = hostDeviceId !== '' && hostDeviceId !== 'default';
      const audioConstraints: MediaTrackConstraints = {
        ...(hostDeviceId ? { deviceId: { exact: hostDeviceId } } : {}),
        echoCancellation: !isInterface,
        noiseSuppression: !isInterface,
        autoGainControl: !isInterface,
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
      // Re-enumerate now that permission is granted — gets real device labels.
      void enumerateAudioInputs();
      localStreamRef.current = stream;
      ensureMixer(stream);
      if (monitorRef.current) monitorRef.current.srcObject = stream;
      connectSocket();
    } catch { setIsStarting(false); setMessage('Microphone access was denied.'); }
  }, [connectSocket, ensureMixer, enumerateAudioInputs, hostDeviceId, peerId]);

  const toggleAllowGuests = useCallback((enabled: boolean) => {
    setAllowGuests(enabled);
    sendJson({ type: 'set_jam_mode', peerId, enabled });
    if (!enabled) stopAllGuestPeers();
  }, [peerId, sendJson, stopAllGuestPeers]);

  useEffect(() => () => { teardown(); }, [teardown]);

  // GUEST

  const guestSendJson = useCallback((payload: unknown) => {
    if (guestWsRef.current?.readyState === WebSocket.OPEN) guestWsRef.current.send(JSON.stringify(payload));
  }, []);

  const teardownGuest = useCallback(() => {
    guestSendJson({ type: 'leave', peerId: guestPeerId });
    guestPcRef.current?.close(); guestPcRef.current = null;
    for (const t of guestStreamRef.current?.getTracks() ?? []) t.stop();
    guestStreamRef.current = null;
    if (guestAudioRef.current) guestAudioRef.current.srcObject = null;
    guestWsRef.current?.close(); guestWsRef.current = null;
    guestRemoteDescSetRef.current = false;
    guestEarlyIceBufRef.current = [];
    setGuestStatus('idle');
    setGuestMessage('');
  }, [guestPeerId, guestSendJson]);

  const handleGuestServerMessage = useCallback(
    async (payload: SignalServerMessage) => {
      if (payload.type === 'station_status') {
        setStatus(payload as unknown as StationStatus);
        if ((payload as unknown as StationStatus).stationState !== 'live' || !(payload as unknown as StationStatus).jamMode) {
          setGuestMessage('The session ended.'); teardownGuest();
        }
        return;
      }
      if (payload.type === 'guest_rejected') {
        setGuestStatus('rejected'); setGuestMessage(payload.reason);
        for (const t of guestStreamRef.current?.getTracks() ?? []) t.stop();
        guestStreamRef.current = null; guestWsRef.current?.close(); guestWsRef.current = null;
        return;
      }
      if (payload.type === 'guest_accepted') {
        const pc = new RTCPeerConnection(rtcConfig);
        guestPcRef.current = pc;
        for (const track of guestStreamRef.current?.getTracks() ?? []) pc.addTrack(track, guestStreamRef.current!);
        pc.ontrack = (ev) => {
          if (guestAudioRef.current) { guestAudioRef.current.srcObject = ev.streams[0] ?? null; guestAudioRef.current.play().catch(() => undefined); }
        };
        pc.onicecandidate = (ev) => {
          if (!ev.candidate) return;
          guestSendJson({ type: 'ice_candidate', peerId: guestPeerId, targetPeerId: payload.hostPeerId, candidate: serializeCandidate(ev.candidate) });
        };
        pc.onconnectionstatechange = () => {
          if (['closed', 'failed', 'disconnected'].includes(pc.connectionState)) { setGuestStatus('idle'); setGuestMessage('Connection to host lost.'); }
          if (pc.connectionState === 'connected') { setGuestStatus('live'); setGuestMessage('You are on air.'); }
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        guestSendJson({ type: 'sdp_offer', peerId: guestPeerId, targetPeerId: payload.hostPeerId, sdp: offer.sdp ?? '' });
        return;
      }
      if (payload.type === 'peer_answer') {
        if (!guestPcRef.current) return;
        await guestPcRef.current.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
        guestRemoteDescSetRef.current = true;
        for (const c of guestEarlyIceBufRef.current) { try { await guestPcRef.current.addIceCandidate(c); } catch { /* stale */ } }
        guestEarlyIceBufRef.current = [];
        return;
      }
      if (payload.type === 'ice_candidate') {
        if (!guestPcRef.current) return;
        if (guestRemoteDescSetRef.current) { try { await guestPcRef.current.addIceCandidate(payload.candidate); } catch { /* stale */ } }
        else { guestEarlyIceBufRef.current.push(payload.candidate); }
        return;
      }
      if (payload.type === 'force_disconnect') { setGuestMessage(payload.reason); teardownGuest(); }
    },
    [guestPeerId, guestSendJson, teardownGuest],
  );

  const joinAsGuest = useCallback(async () => {
    setGuestStatus('joining'); setGuestMessage('Requesting microphone access\u2026');
    try {
      const isInterface = guestDeviceId !== '' && guestDeviceId !== 'default';
      const audioConstraints: MediaTrackConstraints = {
        ...(guestDeviceId ? { deviceId: { exact: guestDeviceId } } : {}),
        echoCancellation: !isInterface,
        noiseSuppression: !isInterface,
        autoGainControl: !isInterface,
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
      void enumerateAudioInputs();
      guestStreamRef.current = stream;
      const ws = new WebSocket(getSignalUrl());
      guestWsRef.current = ws;
      ws.onopen = () => { guestSendJson({ type: 'join_as_guest', peerId: guestPeerId, displayName: guestDisplayName.trim() || undefined }); setGuestMessage('Connecting to host\u2026'); };
      ws.onmessage = (ev) => { try { void handleGuestServerMessage(JSON.parse(ev.data) as SignalServerMessage); } catch { /* ignore */ } };
      ws.onclose = () => { setGuestStatus((s) => s === 'live' ? 'idle' : s); };
    } catch { setGuestStatus('idle'); setGuestMessage('Microphone access was denied.'); }
  }, [enumerateAudioInputs, guestDeviceId, guestDisplayName, guestPeerId, guestSendJson, handleGuestServerMessage]);

  useEffect(() => () => { teardownGuest(); }, [teardownGuest]);

  // RENDER

  const showGuestJoin = status?.jamMode && status?.stationState === 'live' && !isLive && !isStarting && guestStatus !== 'live';

  return (
    <div className="space-y-6">
      {/* Host broadcaster card */}
      <div className="rounded-[2rem] border border-stone-300/70 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <StatusBadge state={status?.stationState ?? 'open'} />
            <h2 className="text-3xl font-semibold text-ink">Broadcaster</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Anonymous by default. Tap start, allow microphone access, and you become the live host.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void start()} disabled={isStarting || isLive}
              className="rounded-full border border-ink bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:border-accent-red hover:bg-accent-red disabled:opacity-50">
              {isLive ? 'Live now' : isStarting ? 'Starting\u2026' : 'Start'}
            </button>
            <button type="button" onClick={() => teardown()}
              className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-ink transition hover:border-accent-red hover:text-accent-red">
              Stop
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-stone-300/70 bg-paper/90 p-6 space-y-4">
          <label className="block text-sm text-muted">
            Audio input
            <select
              value={hostDeviceId}
              onChange={(e) => setHostDeviceId(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-ink outline-none focus:border-accent-red"
            >
              <option value="">Default microphone</option>
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Input ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            {hostDeviceId && hostDeviceId !== 'default' && (
              <span className="mt-1 inline-block text-xs text-emerald-600">DSP off — clean signal for interfaces &amp; virtual cables</span>
            )}
          </label>

          <label className="block text-sm text-muted">
            Display name (optional)
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-ink outline-none focus:border-accent-red"
              placeholder="DJ Dogboat" maxLength={80} />
          </label>

          <audio ref={monitorRef} muted autoPlay className="hidden" />

          <div className="space-y-1 text-sm text-muted">
            <p>{message}</p>
            <p>{status?.listenerCount ?? 0} listener{status?.listenerCount === 1 ? '' : 's'} connected.</p>
            <p>{status?.broadcasterPresent ? 'A broadcaster is attached.' : 'The slot is free.'}</p>
          </div>

          {isLive && (
            <div className="pt-3 border-t border-stone-200 space-y-2">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <button type="button" role="switch" aria-checked={allowGuests} onClick={() => toggleAllowGuests(!allowGuests)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${allowGuests ? 'bg-accent-red' : 'bg-stone-300'}`}>
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${allowGuests ? 'translate-x-4' : ''}`} />
                </button>
                <span className="text-sm font-medium text-ink">Allow guests</span>
                {(status?.guestCount ?? 0) > 0 && (
                  <span className="ml-auto text-xs font-semibold text-accent-red">{status?.guestCount}/4 on air</span>
                )}
              </label>
              {allowGuests && <p className="text-xs text-muted">Guests can join from this page. Their audio mixes into your broadcast automatically.</p>}
              {allowGuests && (status?.guestPeerIds?.length ?? 0) > 0 && (
                <ul className="mt-1 space-y-1">
                  {status?.guestPeerIds.map((id) => (
                    <li key={id} className="text-xs text-muted flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                      Guest <code className="font-mono">{id.slice(0, 8)}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-stone-300/70 bg-white/70 p-6 text-sm text-muted">
          <h3 className="text-lg font-semibold text-ink">Rules</h3>
          <ul className="mt-4 space-y-3 leading-6">
            <li>• One host at a time.</li>
            <li>• Up to 4 guests when host enables them.</li>
            <li>• Guests mix into the broadcast automatically.</li>
            <li>• If your browser is blocked, this page will tell you directly.</li>
          </ul>
          <p className="mt-6 text-xs text-stone-300 select-none" title="v2 jam mode">&#x1F43E;</p>
        </div>
      </div>

      {/* Guest join section */}
      {showGuestJoin && (
        <div className="rounded-[2rem] border border-accent-red/40 bg-white/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-accent-red animate-pulse" />
            <h3 className="text-xl font-semibold text-ink">Join as Guest</h3>
            <span className="ml-auto text-xs text-muted">{status?.guestCount ?? 0}/4 slots</span>
          </div>
          <p className="text-sm text-muted">The host has opened the mic. Your audio will mix live into the broadcast.</p>
          <label className="block text-sm text-muted">
            Audio input
            <select
              value={guestDeviceId}
              onChange={(e) => setGuestDeviceId(e.target.value)}
              disabled={guestStatus === 'joining'}
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-ink outline-none focus:border-accent-red disabled:opacity-50"
            >
              <option value="">Default microphone</option>
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Input ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-muted">
            Your name (optional)
            <input value={guestDisplayName} onChange={(e) => setGuestDisplayName(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-ink outline-none focus:border-accent-red"
              placeholder="Anonymous" maxLength={80} disabled={guestStatus === 'joining'} />
          </label>
          {guestMessage && <p className="text-sm text-muted">{guestMessage}</p>}
          <button type="button" onClick={() => void joinAsGuest()} disabled={guestStatus === 'joining' || (status?.guestCount ?? 0) >= 4}
            className="rounded-full border border-accent-red bg-accent-red px-6 py-3 text-sm font-semibold text-white transition hover:opacity-80 disabled:opacity-50">
            {guestStatus === 'joining' ? 'Connecting\u2026' : 'Join'}
          </button>
          <audio ref={guestAudioRef} autoPlay className="hidden" />
        </div>
      )}

      {/* Guest live card */}
      {guestStatus === 'live' && (
        <div className="rounded-[2rem] border border-green-400/60 bg-white/80 p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <h3 className="text-xl font-semibold text-ink">You are on air as a guest</h3>
          </div>
          <p className="text-sm text-muted">{guestMessage}</p>
          <button type="button" onClick={() => teardownGuest()}
            className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-ink transition hover:border-accent-red hover:text-accent-red">
            Leave
          </button>
          <audio ref={guestAudioRef} autoPlay className="hidden" />
        </div>
      )}
    </div>
  );
}
